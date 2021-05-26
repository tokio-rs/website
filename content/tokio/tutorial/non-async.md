---
title: "Non-async projects"
---

In the examples we have seen so far, we marked the main function with
`#[tokio::main]` and made the entire project asynchronous. However you don't
have to do this to use Tokio in your project. This page explains how you can
isolate async/await to a small part of your project.

# What `#[tokio::main]` expands to

The `#[tokio::main]` macro is a macro that replaces your main function with a
non-async main function that starts a runtime and then calls your code. For
instance, this:
```rust
#[tokio::main]
async fn main() {
    println!("Hello world");
}
```
is turned into this:
```
fn main() {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            println!("Hello world");
        })
}
```
by the macro. To use async/await in our own projects, we will do something
similar.

# Ways to approach it

There are a few ways you can approach the problem of using async/await in only
part of your project. These are:

 * Create a [`Runtime`] and call [`block_on`] on the async code.
 * Create a [`Runtime`] and [`spawn`] things on it.
 * Run the [`Runtime`] in a separate thread and send messages to it.

The main differences between the above approaches are whether the runtime is
able to run stuff in the background, and how you shut the runtime down.

## Using `block_on`

The simplest way to transition from synchronous to asynchronous code is to call
the [`block_on`] method. To do this, you first create a [`Runtime`], then call
[`block_on`]. For example:
```rust
use tokio::runtime::Builder;

fn main() {
    println!("In non-async code!");

    let runtime = Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    runtime.block_on(my_async_fn());

    println!("Back in non-async code!");
}

async fn my_async_fn() {
    println!("Now in async code!");
}
```
If you compare this to the previous example from the `#[tokio::main]` macro you
will see that it is very similar, however there is one difference: This example
uses the [`current_thread`] runtime rather than the [`multi_thread`] runtime.
Either choice would work, but the `current_thread` runtime is cheaper to use
because it does not spawn any threads.

Be aware that using the `current_thread` runtime has the consequence that, since
the runtime has no threads of its own, it is unable to execute tasks in the
background. However if you are only going to be using its `block_on` method,
that doesn't matter to you.

[[info]]
| The [`multi_thread`] runtime does not have to be multi-threaded. If you set
| the number of [`worker_threads`] to one, it will spawn only a single thread.
| This is still different from a `current_thread` runtime because a
| `current_thread` runtime will spawn _zero_ threads rather than one.

## Using `spawn`

The [`Runtime`] also has a method called [`spawn`]. When you call this method,
you create a new background task to run on the runtime. For example:
```rust
use tokio::runtime::Builder;
use tokio::time::{sleep, Duration};

fn main() {
    let runtime = Builder::new_multi_thread()
        .worker_threads(1)
        .enable_all()
        .build()
        .unwrap();

    let mut handles = Vec::with_capacity(10);
    for i in 0..10 {
        handles.push(runtime.spawn(my_bg_task(i)));
    }

    // Do something time-consuming while the background tasks execute.
    std::thread::sleep(Duration::from_millis(750));
    println!("Finished time-consuming task.");

    // Wait for all of them to complete.
    for handle in handles {
        // The `spawn` method returns a `JoinHandle`. A `JoinHandle` is
        // a future, so we can wait for it using `block_on`.
        runtime.block_on(handle).unwrap();
    }
}

async fn my_bg_task(i: u64) {
    // By subtracting, the tasks with larger values of i sleep for a
    // shorter duration.
    let millis = 1000 - 50 * i;
    println!("Task {} sleeping for {} ms.", i, millis);

    sleep(Duration::from_millis(millis)).await;

    println!("Task {} stopping.", i);
}
```
In the above example, we spawn 10 background tasks on the runtime, then wait
for all of them. As an example, this could be a good way of implementing
background network requests in a graphical application because network requests
are too time consuming to run them on the main GUI thread. Instead, you spawn
the request on a Tokio runtime running in the background, and have the task send
information back to the GUI code when the request has finished, or even
incrementally if you want a progress bar.

In this example, it is important that the runtime is configured to be a
[`multi_thread`] runtime. If you change it to be a [`current_thread`] runtime,
you will find that the time consuming task finishes before any of the background
tasks start. This is because background tasks spawned on a `current_thread`
runtime will only execute during calls to `block_on` as the runtime otherwise
doesn't have anywhere to run them.

The example waits for the spawned tasks to finish by calling `block_on` on the
[`JoinHandle`] returned by the call to [`spawn`], but this isn't the only way to
do it. Here are some alternatives:

 * Use a message passing channel such as [`tokio::sync::mpsc`].
 * Modify a shared value protected by e.g. a `Mutex`.

Note that the `spawn` method is also available on the [`Handle`] type, which is
an easy way to share a runtime with many parts of the program.

## Sending messages

The third technique is to spawn a runtime and use message passing to communicate
with it. This involves a bit more boilerplate than the other two approaches, but
it is the most flexible approach. You can find a basic example below:

```rust
use tokio::runtime::Builder;
use tokio::sync::mpsc;

pub struct Task {
    name: String,
    // info that describes the task
}

async fn handle_task(task: Task) {
    println!("Got task {}", task.name);
}

#[derive(Clone)]
pub struct TaskSpawner {
    spawn: mpsc::Sender<Task>,
}

impl TaskSpawner {
    pub fn new() -> TaskSpawner {
        let (send, mut recv) = mpsc::channel(16);
        let rt = Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        std::thread::spawn(move || {
            rt.block_on(async move {
                while let Some(task) = recv.recv().await {
                    tokio::spawn(handle_task(task));
                }

                // Once all senders have gone out of scope,
                // the `.recv()` call returns None and it will
                // exit from the while loop and shut down the
                // thread.
            });
        });

        TaskSpawner {
            spawn: send,
        }
    }

    pub fn spawn_task(&self, task: Task) {
        match self.spawn.blocking_send(task) {
            Ok(()) => {},
            Err(_) => panic!("Our runtime has shut down."),
        }
    }
}
```
This example could be configured in many ways. For instance, you could use a
[`Semaphore`] to limit the number of active tasks, or you could use a channel in
the opposite direction to send a response to the spawner.

# A synchronous interface to mini-redis



[`Runtime`]: https://docs.rs/tokio/1/tokio/runtime/struct.Runtime.html
[`block_on`]: https://docs.rs/tokio/1/tokio/runtime/struct.Runtime.html#method.block_on
[`spawn`]: https://docs.rs/tokio/1/tokio/runtime/struct.Runtime.html#method.spawn
[`multi_thread`]: https://docs.rs/tokio/1/tokio/runtime/struct.Builder.html#method.new_multi_thread
[`current_thread`]: https://docs.rs/tokio/1/tokio/runtime/struct.Builder.html#method.new_current_thread
[`worker_threads`]: https://docs.rs/tokio/1/tokio/runtime/struct.Builder.html#method.worker_threads
[`JoinHandle`]: https://docs.rs/tokio/1/tokio/task/struct.JoinHandle.html
[`tokio::sync::mpsc`]: https://docs.rs/tokio/1/tokio/sync/mpsc/index.html
[`Handle`]: https://docs.rs/tokio/1/tokio/runtime/struct.Handle.html
[`Semaphore`]: https://docs.rs/tokio/1/tokio/sync/struct.Semaphore.html
