//! Demonstrates how to implement a (very) basic asynchronous rust executor and
//! timer. The goal of this file is to provide some context into how the various
//! building blocks fit together.

use futures::future::BoxFuture;
use std::cell::RefCell;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll, Waker};
use std::thread;
use std::time::{Duration, Instant};
// A utility that allows us to implement a `std::task::Waker` without having to
// use `unsafe` code.
use futures::task::{self, ArcWake};
// Used as a channel to queue scheduled tasks.
use crossbeam::channel;

// Main entry point. A mini-tokio instance is created and a few tasks are
// spawned. Our mini-tokio implementation only supports spawning tasks and
// setting delays.
fn main() {
    // Create the mini-tokio instance.
    let mini_tokio = MiniTokio::new();

    // Spawn the root task. All other tasks are spawned from the context of this
    // root task. No work happens until `mini_tokio.run()` is called.
    mini_tokio.spawn(async {
        // Spawn a task
        spawn(async {
            // Wait for a little bit of time so that "world" is printed after
            // "hello"
            delay(Duration::from_millis(100)).await;
            println!("world");
        });

        // Spawn a second task
        spawn(async {
            println!("hello");
        });

        // We haven't implemented executor shutdown, so force the process to exit.
        delay(Duration::from_millis(200)).await;
        std::process::exit(0);
    });

    // Start the mini-tokio executor loop. Scheduled tasks are received and
    // executed.
    mini_tokio.run();
}

/// A very basic futures executor based on a channel. When tasks are woken, they
/// are scheduled by queuing them in the send half of the channel. The executor
/// waits on the receive half and executes received tasks.
///
/// When a task is executed, the send half of the channel is passed along via
/// the task's Waker.
struct MiniTokio {
    // Receives scheduled tasks. When a task is scheduled, the associated future
    // is ready to make progress. This usually happens when a resource the task
    // uses becomes ready to perform an operation. For example, a socket
    // received data and a `read` call will succeed.
    scheduled: channel::Receiver<Arc<Task>>,

    // Send half of the scheduled channel.
    sender: channel::Sender<Arc<Task>>,
}

impl MiniTokio {
    /// Initialize a new mini-tokio instance.
    fn new() -> MiniTokio {
        let (sender, scheduled) = channel::unbounded();

        MiniTokio { scheduled, sender }
    }

    /// Spawn a future onto the mini-tokio instance.
    ///
    /// The given future is wrapped with the `Task` harness and pushed into the
    /// `scheduled` queue. The future will be executed when `run` is called.
    fn spawn<F>(&self, future: F)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        Task::spawn(future, &self.sender);
    }

    /// Run the executor.
    ///
    /// This starts the executor loop and runs it indefinitely. No shutdown
    /// mechanism has been implemented.
    ///
    /// Tasks are popped from the `scheduled` channel receiver. Receiving a task
    /// on the channel signifies the task is ready to be executed. This happens
    /// when the task is first created and when its waker has been used.
    fn run(&self) {
        // Set the CURRENT thread-local to point to the current executor.
        //
        // Tokio uses a thread-local variable to implement `tokio::spawn`. When
        // entering the runtime, the executor stores necessary context with the
        // thread-local to support spawning new tasks.
        CURRENT.with(|cell| {
            *cell.borrow_mut() = Some(self.sender.clone());
        });

        // The executor loop. Scheduled tasks are received. If the channel is
        // empty, the thread blocks until a task is received.
        while let Ok(task) = self.scheduled.recv() {
            // Execute the task until it either completes or cannot make further
            // progress and returns `Poll::Pending`.
            task.poll();
        }
    }
}

// An equivalent to `tokio::spawn`. When entering the mini-tokio executor, the
// `CURRENT` thread-local is set to point to that executor's channel's Send
// half. Then, spawning requires creating the `Task` harness for the given
// `future` and pushing it into the scheduled queue.
pub fn spawn<F>(future: F)
where
    F: Future<Output = ()> + Send + 'static,
{
    CURRENT.with(|cell| {
        let borrow = cell.borrow();
        let sender = borrow.as_ref().unwrap();
        Task::spawn(future, sender);
    });
}

// Asynchronous equivalent to `thread::sleep`. Awaiting on this function pauses
// for the given duration.
//
// mini-tokio implements delays by spawning a timer thread that sleeps for the
// requested duration and notifies the caller once the delay completes. A thread
// is spawned **per** call to `delay`. This is obviously a terrible
// implementation strategy and nobody should use this in production. Tokio does
// not use this strategy. However, it can be implemented with few lines of code,
// so here we are.
async fn delay(dur: Duration) {
    // `delay` is a leaf future. Sometimes, this is refered to as a "resource".
    // Other resources include sockets and channels. Resources may not be
    // implemented in terms of `async/await` as they must integrate with some
    // operating system detail. Because of this, we must manually implement the
    // `Future`.
    //
    // However, it is nice to expose the API as an `async fn`. A useful idiom is
    // to manually define a private future and then use it from a public `async
    // fn` API.
    struct Delay {
        // When to complete the delay.
        when: Instant,
        // The waker to notify once the delay has completed. The waker must be
        // accessible by both the timer thread and the future so it is wrapped
        // with `Arc<Mutex<_>>`
        waker: Option<Arc<Mutex<Waker>>>,
    }

    impl Future for Delay {
        type Output = ();

        fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<()> {
            // First, if this is the first time the future is called, spawn the
            // timer thread. If the timer thread is already running, ensure the
            // stored `Waker` matches the current task's waker.
            if let Some(waker) = &self.waker {
                let mut waker = waker.lock().unwrap();

                // Check if the stored waker matches the current tasks waker.
                // This is necessary as the `Delay` future instance may move to
                // a different task between calls to `poll`. If this happens, the
                // waker contained by the given `Context` will differ and we
                // must update our stored waker to reflect this change.
                if !waker.will_wake(cx.waker()) {
                    *waker = cx.waker().clone();
                }
            } else {
                let when = self.when;
                let waker = Arc::new(Mutex::new(cx.waker().clone()));
                self.waker = Some(waker.clone());

                // This is the first time `poll` is called, spawn the timer thread.
                thread::spawn(move || {
                    let now = Instant::now();

                    if now < when {
                        thread::sleep(when - now);
                    }

                    // The duration has elapsed. Notify the caller by invoking
                    // the waker.
                    let waker = waker.lock().unwrap();
                    waker.wake_by_ref();
                });
            }

            // Once the waker is stored and the timer thread is started, it is
            // time to check if the delay has completed. This is done by
            // checking the current instant. If the duration has elapsed, then
            // the future has completed and `Poll::Ready` is returned.
            if Instant::now() >= self.when {
                Poll::Ready(())
            } else {
                // The duration has not elapsed, the future has not completed so
                // return `Poll::Pending`.
                //
                // The `Future` trait contract requires that when `Pending` is
                // returned, the future ensures that the given waker is signaled
                // once the future should be polled again. In our case, by
                // returning `Pending` here, we are promising that we will
                // invoke the given waker included in the `Context` argument
                // once the requested duration has elapsed. We ensure this by
                // spawning the timer thread above.
                //
                // If we forget to invoke the waker, the task will hang
                // indefinitely.
                Poll::Pending
            }
        }
    }

    // Create an instance of our `Delay` future.
    let future = Delay {
        when: Instant::now() + dur,
        waker: None,
    };

    // Wait for the duration to complete.
    future.await;
}

// Used to track the current mini-tokio instance so that the `spawn` function is
// able to schedule spawned tasks.
thread_local! {
    static CURRENT: RefCell<Option<channel::Sender<Arc<Task>>>> =
        RefCell::new(None);
}

// Task harness. Contains the future as well as the necessary data to schedule
// the future once it is woken.
struct Task {
    // The future is wrapped with a `Mutex` to make the `Task` structure `Sync`.
    // There will only ever be a single thread that attempts to use `future`.
    // The Tokio runtime avoids the mutex by using `unsafe` code. The box is
    // also avoided.

    // BoxFuture<T> is a type alias for:
    // Pin<Box<dyn Future<Output = T> + Send + 'static>>
    future: Mutex<BoxFuture<'static, ()>>,

    // When a task is notified, it is queued into this channel. The executor
    // pops notified tasks and executes them.
    executor: channel::Sender<Arc<Task>>,
}

impl Task {
    // Spawns a new task with the given future.
    //
    // Initializes a new Task harness containing the given future and pushes it
    // onto `sender`. The receiver half of the channel will get the task and
    // execute it.
    fn spawn<F>(future: F, sender: &channel::Sender<Arc<Task>>)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        let task = Arc::new(Task {
            future: Mutex::new(Box::pin(future)),
            executor: sender.clone(),
        });

        let _ = sender.send(task);
    }

    // Execute a scheduled task. This creates the necessary `task::Context`
    // containing a waker for the task. This waker pushes the task onto the
    // mini-tokio scheduled channel. The future is then polled with the waker.
    fn poll(self: Arc<Self>) {
        // Get a waker referencing the task.
        let waker = task::waker(self.clone());
        // Initialize the task context with the waker.
        let mut cx = Context::from_waker(&waker);

        // This will never block as only a single thread ever locks the future.
        let mut future = self.future.try_lock().unwrap();

        // Poll the future
        let _ = future.as_mut().poll(&mut cx);
    }
}

// The standard library provides low-level, unsafe  APIs for defining wakers.
// Instead of writing unsafe code, we will use the helpers provided by the
// `futures` crate to define a waker that is able to schedule our `Task`
// structure.
impl ArcWake for Task {
    fn wake_by_ref(arc_self: &Arc<Self>) {
        // Schedule the task for execution. The executor receives from the
        // channel and polls tasks.
        let _ = arc_self.executor.send(arc_self.clone());
    }
}
