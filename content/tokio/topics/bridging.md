---
title: "Bridging with sync code"
---

In most examples of using Tokio, we mark the main function with `#[tokio::main]`
and make the entire project asynchronous.

In some cases, you may need to run a small portion of synchronous code.  For more
information on that, see [`spawn_blocking`].

In other cases, it may be easier to structure the application as largely
synchronous, with smaller or logically distinct asynchronous portions.
For instance, a GUI application might want to run the GUI code on the
main thread and run a Tokio runtime next to it on another thread.

This page explains how you can isolate async/await to a small part of your
project.

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
by the macro. To use async/await in our own projects, we can do something
similar where we leverage the [`block_on`] method to enter the asynchronous
context where appropriate.

# A synchronous interface to mini-redis

In this section, we will go through how to build a synchronous interface to
mini-redis by storing a `Runtime` object and using its `block_on` method.
In the following sections, we will discuss some alternate approaches and when
you should use each approach.

The interface that we will be wrapping is the asynchronous [`Client`] type. It
has several methods, and we will implement a blocking version of the following
methods:

 * [`Client::get`]
 * [`Client::set`]
 * [`Client::set_expires`]
 * [`Client::publish`]
 * [`Client::subscribe`]

To do this, we introduce a new file called `src/clients/blocking_client.rs` and
initialize it with a wrapper struct around the async `Client` type:
```rs
use tokio::net::ToSocketAddrs;
use tokio::runtime::Runtime;

pub use crate::clients::client::Message;

/// Established connection with a Redis server.
pub struct BlockingClient {
    /// The asynchronous `Client`.
    inner: crate::clients::Client,

    /// A `current_thread` runtime for executing operations on the
    /// asynchronous client in a blocking manner.
    rt: Runtime,
}

impl BlockingClient {
    pub fn connect<T: ToSocketAddrs>(addr: T) -> crate::Result<BlockingClient> {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?;

        // Call the asynchronous connect method using the runtime.
        let inner = rt.block_on(crate::clients::Client::connect(addr))?;

        Ok(BlockingClient { inner, rt })
    }
}
```
Here, we have included the constructor function as our first example of how to
execute asynchronous methods in a non-async context. We do this using the
[`block_on`] method on the Tokio [`Runtime`] type, which executes an
asynchronous method and returns its result.

One important detail is the use of the [`current_thread`] runtime. Usually when
using Tokio, you would be using the default [`multi_thread`] runtime, which will
spawn a bunch of background threads so it can efficiently run many things at the
same time. For our use-case, we are only going to be doing one thing at the
time, so we won't gain anything by running multiple threads. This makes the
[`current_thread`] runtime a perfect fit as it doesn't spawn any threads.

The [`enable_all`] call enables the IO and timer drivers on the Tokio runtime.
If they are not enabled, the runtime is unable to perform IO or timers.

> **warning**
> Because the `current_thread` runtime does not spawn threads, it only operates
> when `block_on` is called. Once `block_on` returns, all spawned tasks on that
> runtime will freeze until you call `block_on` again. Use the `multi_threaded`
> runtime if spawned tasks must keep running when not calling `block_on`.

Once we have this struct, most of the methods are easy to implement:
```rs
use bytes::Bytes;
use std::time::Duration;

impl BlockingClient {
    pub fn get(&mut self, key: &str) -> crate::Result<Option<Bytes>> {
        self.rt.block_on(self.inner.get(key))
    }

    pub fn set(&mut self, key: &str, value: Bytes) -> crate::Result<()> {
        self.rt.block_on(self.inner.set(key, value))
    }

    pub fn set_expires(
        &mut self,
        key: &str,
        value: Bytes,
        expiration: Duration,
    ) -> crate::Result<()> {
        self.rt.block_on(self.inner.set_expires(key, value, expiration))
    }

    pub fn publish(&mut self, channel: &str, message: Bytes) -> crate::Result<u64> {
        self.rt.block_on(self.inner.publish(channel, message))
    }
}
```
The [`Client::subscribe`] method is more interesting because it transforms the
`Client` into a `Subscriber` object. We can implement it in the following
manner:
```rs
/// A client that has entered pub/sub mode.
///
/// Once clients subscribe to a channel, they may only perform
/// pub/sub related commands. The `BlockingClient` type is
/// transitioned to a `BlockingSubscriber` type in order to
/// prevent non-pub/sub methods from being called.
pub struct BlockingSubscriber {
    /// The asynchronous `Subscriber`.
    inner: crate::clients::Subscriber,

    /// A `current_thread` runtime for executing operations on the
    /// asynchronous client in a blocking manner.
    rt: Runtime,
}

impl BlockingClient {
    pub fn subscribe(self, channels: Vec<String>) -> crate::Result<BlockingSubscriber> {
        let subscriber = self.rt.block_on(self.inner.subscribe(channels))?;
        Ok(BlockingSubscriber {
            inner: subscriber,
            rt: self.rt,
        })
    }
}

impl BlockingSubscriber {
    pub fn get_subscribed(&self) -> &[String] {
        self.inner.get_subscribed()
    }

    pub fn next_message(&mut self) -> crate::Result<Option<Message>> {
        self.rt.block_on(self.inner.next_message())
    }

    pub fn subscribe(&mut self, channels: &[String]) -> crate::Result<()> {
        self.rt.block_on(self.inner.subscribe(channels))
    }

    pub fn unsubscribe(&mut self, channels: &[String]) -> crate::Result<()> {
        self.rt.block_on(self.inner.unsubscribe(channels))
    }
}
```
So, the `subscribe` method will first use the runtime to transform the
asynchronous `Client` into an asynchronous `Subscriber`. Then, it will store the
resulting `Subscriber` together with the `Runtime` and implement the various
methods using [`block_on`].

Note that the asynchronous `Subscriber` struct has a non-async method called
`get_subscribed`. To handle this, we simply call it directly without involving
the runtime.

# Other approaches

The above section explains the simplest way to implement a synchronous wrapper,
but it is not the only way. The approaches are:

 * Create a [`Runtime`] and call [`block_on`] on the async code.
 * Create a [`Runtime`] and [`spawn`] things on it.
 * Run the [`Runtime`] in a separate thread and send messages to it.

We already saw the first approach. The two other approaches are outlined below.

## Spawning things on a runtime

The [`Runtime`] object has a method called [`spawn`]. When you call this method,
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
```text
Task 0 sleeping for 1000 ms.
Task 1 sleeping for 950 ms.
Task 2 sleeping for 900 ms.
Task 3 sleeping for 850 ms.
Task 4 sleeping for 800 ms.
Task 5 sleeping for 750 ms.
Task 6 sleeping for 700 ms.
Task 7 sleeping for 650 ms.
Task 8 sleeping for 600 ms.
Task 9 sleeping for 550 ms.
Task 9 stopping.
Task 8 stopping.
Task 7 stopping.
Task 6 stopping.
Finished time-consuming task.
Task 5 stopping.
Task 4 stopping.
Task 3 stopping.
Task 2 stopping.
Task 1 stopping.
Task 0 stopping.
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
 * Modify a shared value protected by e.g. a `Mutex`. This can be a good
   approach for a progress bar in a GUI, where the GUI reads the shared value
   every frame.

The `spawn` method is also available on the [`Handle`] type. The `Handle` type
can be cloned to get many handles to a runtime, and each `Handle` can be used to
spawn new tasks on the runtime.

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
        // Set up a channel for communicating.
        let (send, mut recv) = mpsc::channel(16);

        // Build the runtime for the new thread.
        //
        // The runtime is created before spawning the thread
        // to more cleanly forward errors if the `unwrap()`
        // panics.
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
            Err(_) => panic!("The shared runtime has shut down."),
        }
    }
}
```
This example could be configured in many ways. For instance, you could use a
[`Semaphore`] to limit the number of active tasks, or you could use a channel in
the opposite direction to send a response to the spawner. When you spawn a
runtime in this way, it is a type of [actor].


[`Runtime`]: https://docs.rs/tokio/1/tokio/runtime/struct.Runtime.html
[`block_on`]: https://docs.rs/tokio/1/tokio/runtime/struct.Runtime.html#method.block_on
[`spawn`]: https://docs.rs/tokio/1/tokio/runtime/struct.Runtime.html#method.spawn
[`spawn_blocking`]: https://docs.rs/tokio/1/tokio/task/fn.spawn_blocking.html
[`multi_thread`]: https://docs.rs/tokio/1/tokio/runtime/struct.Builder.html#method.new_multi_thread
[`current_thread`]: https://docs.rs/tokio/1/tokio/runtime/struct.Builder.html#method.new_current_thread
[`worker_threads`]: https://docs.rs/tokio/1/tokio/runtime/struct.Builder.html#method.worker_threads
[`enable_all`]: https://docs.rs/tokio/1/tokio/runtime/struct.Builder.html#method.enable_all
[`JoinHandle`]: https://docs.rs/tokio/1/tokio/task/struct.JoinHandle.html
[`tokio::sync::mpsc`]: https://docs.rs/tokio/1/tokio/sync/mpsc/index.html
[`Handle`]: https://docs.rs/tokio/1/tokio/runtime/struct.Handle.html
[`Semaphore`]: https://docs.rs/tokio/1/tokio/sync/struct.Semaphore.html
[`Client`]: https://docs.rs/mini-redis/0.4/mini_redis/client/struct.Client.html
[`Client::get`]: https://docs.rs/mini-redis/0.4/mini_redis/client/struct.Client.html#method.get
[`Client::set`]: https://docs.rs/mini-redis/0.4/mini_redis/client/struct.Client.html#method.set
[`Client::set_expires`]: https://docs.rs/mini-redis/0.4/mini_redis/client/struct.Client.html#method.set_expires
[`Client::publish`]: https://docs.rs/mini-redis/0.4/mini_redis/client/struct.Client.html#method.publish
[`Client::subscribe`]: https://docs.rs/mini-redis/0.4/mini_redis/client/struct.Client.html#method.subscribe
[actor]: https://ryhl.io/blog/actors-with-tokio/
