---
title: "Runtime Model"
weight : 7030
menu:
  docs:
    parent: going_deeper
---

Now we will go over the Tokio / futures runtime model. Tokio is built on top of
the [`futures`] crate and uses its runtime model. This allows it to interop
with other libraries also using the [`futures`] crate.

**Note**: This runtime model is very different than async libraries found in
other languages. While, at a high level, APIs can look similar, the way code
gets executed differs.

# Synchronous Model

First, let's talk briefly about the synchronous (or blocking) model. This is the
model that the Rust [standard library] uses.

```rust
# use std::io::prelude::*;
# use std::net::TcpStream;
# fn dox(mut socket: TcpStream) {
// let socket = ...;
let mut buf = [0; 1024];
let n = socket.read(&mut buf).unwrap();

// Do something with &buf[..n];
# }
# fn main() {}
```

When `socket.read` is called, either the socket has pending data in its receive
buffer or it does not. If there is pending data, then the call to `read` will
return immediately and `buf` will be filled with that data. However, if there is
no pending data, then the `read` function will block the current thread until
data is received. At which time, `buf` will be filled with this newly received
data and the `read` function will return.

In order to perform reads on many different sockets concurrently, a thread per
socket is required. Using a thread per socket does not scale up very well to
large numbers of sockets. This is known as the [c10k] problem.

# Non-blocking sockets

The way to avoid blocking a thread when performing an operation like read is to
not block the thread! When the socket has no pending data in its receive buffer,
the `read` function returns immediately, indicating that the socket was "not
ready" to perform the read operation.

When using a Tokio [`TcpStream`], a call to `read` will always immediately return
a value ([`ErrorKind::WouldBlock`]) even if there is no pending data to read.
If there is no pending data, the caller is responsible for calling `read` again
at a later time.  The trick is to know when that "later time" is.

Another way to think about a non-blocking read is as "polling" the socket for
data to read.

# Polling Model

The strategy of polling a socket for data can be generalized to any operation.
For example, a function to get a "widget" in the polling model would look
something like this:

```rust,ignore
fn poll_widget() -> Async<Widget> { ... }
```

This function returns an `Async<Widget>` where [`Async`] is an enum of
`Ready(Widget)` or `NotReady`. The [`Async`] enum is provided by the [`futures`]
crate and is one of the building blocks of the polling model.

Now, lets define an asynchronous task without combinators that uses this
`poll_widget` function. The task will do the following:

1. Acquire a widget.
2. Print the widget to STDOUT.
3. Terminate the task.

To define a task, we implement the [`Future`] trait.

```rust
# #![deny(deprecated)]
# extern crate futures;
# use futures::{Async, Future};
#
# #[derive(Debug)]
# pub struct Widget;
# fn poll_widget() -> Async<Widget> { unimplemented!() }
#
/// A task that polls a single widget and writes it to STDOUT.
pub struct MyTask;

impl Future for MyTask {
    // The value this future will have when ready
    type Item = ();
    type Error = ();

    fn poll(&mut self) -> Result<Async<()>, ()> {
        match poll_widget() {
            Async::Ready(widget) => {
                println!("widget={:?}", widget);
                Ok(Async::Ready(()))
            }
            Async::NotReady => {
                Ok(Async::NotReady)
            }
        }
    }
}
#
# fn main() {
# }
```

> **Important**: Returning `Async::NotReady` has special meaning. See the [next
> section] for more details.

The key thing to note is, when `MyTask::poll` is called, it immediately tries to
get the widget. If the call to `poll_widget` returns `NotReady`, then the task
is unable to make further progress. The task then returns `NotReady` itself,
indicating that it is not ready to complete processing.

The task implementation does not block. Instead, "sometime in the future", the
executor will call `MyTask::poll` again. `poll_widget` will be called again. If
`poll_widget` is ready to return a widget, then the task, in turn, is ready to
print the widget. The task can then complete by returning `Ready`.

# Executors

In order for the task to make progress, something has to call `MyTask::poll`.
This is the job of an executor.

Executors are responsible for repeatedly calling `poll` on a task until `Ready`
is returned. There are many different ways to do this. For example, the
[`CurrentThread`] executor will block the current thread and loop through all
spawned tasks, calling poll on them. [`ThreadPool`] schedules tasks across a thread
pool. This is also the default executor used by the [runtime][rt].

All tasks **must** be spawned on an executor or no work will be performed.

At the very simplest, an executor could look something like this:

```rust
# #![deny(deprecated)]
# extern crate futures;
# use futures::{Async, Future};
# use std::collections::VecDeque;
#
pub struct SpinExecutor {
    // the tasks an executor is responsible for in
    // a double ended queue
    tasks: VecDeque<Box<Future<Item = (), Error = ()> + Send>>,
}

impl SpinExecutor {
    pub fn spawn<T>(&mut self, task: T)
    where T: Future<Item = (), Error = ()> + 'static + Send
    {
        self.tasks.push_back(Box::new(task));
    }

    pub fn run(&mut self) {
        // Pop tasks off the front in a tight loop
        while let Some(mut task) = self.tasks.pop_front() {
            match task.poll().unwrap() {
                Async::Ready(_) => {}
                Async::NotReady => {
                    // If the task is not ready put it to the back of queue
                    self.tasks.push_back(task);
                }
            }
        }
    }
}
# pub fn main() {}
```

Of course, this would not be very efficient. The executor spins in a busy loop
and tries to poll all tasks even if the task will just return `NotReady` again.

Ideally, there would be some way for the executor to know when the "readiness"
state of a task is changed, i.e. when a call to `poll` will return `Ready`.
Then, the executor would look something like this:

```rust
# #![deny(deprecated)]
# extern crate futures;
# use futures::{Async, Future};
# use std::collections::VecDeque;
#
# pub struct SpinExecutor {
#     ready_tasks: VecDeque<Box<Future<Item = (), Error = ()>>>,
#     not_ready_tasks: VecDeque<Box<Future<Item = (), Error = ()>>>,
# }
#
# impl SpinExecutor {
#     fn sleep_until_tasks_are_ready(&self) {}
#
    pub fn run(&mut self) {
        loop {
            while let Some(mut task) = self.ready_tasks.pop_front() {
                match task.poll().unwrap() {
                    Async::Ready(_) => {}
                    Async::NotReady => {
                        self.not_ready_tasks.push_back(task);
                    }
                }
            }

            if self.not_ready_tasks.is_empty() {
                return;
            }

            // Put the thread to sleep until there is work to do
            self.sleep_until_tasks_are_ready();
        }
    }
# }
# pub fn main() {}
```

Being able to get notified when a task goes from "not ready" to "ready" is the
core of the [`futures`] task model.

[`futures`]: {{< api-url "futures" >}}
[standard library]: https://doc.rust-lang.org/std/
[c10k]: https://en.wikipedia.org/wiki/C10k_problem
[`ErrorKind::WouldBlock`]: https://doc.rust-lang.org/std/io/enum.ErrorKind.html#variant.WouldBlock
[`TcpStream`]: {{< api-url "tokio" >}}/net/struct.TcpStream.html
[`Async`]: {{< api-url "futures" >}}/enum.Async.html
[`Future`]: {{< api-url "futures" >}}/future/trait.Future.html
[`CurrentThread`]: https://docs.rs/tokio-current-thread
[`ThreadPool`]: http://docs.rs/tokio-threadpool
[rt]: {{< api-url "tokio" >}}/runtime/index.html
[next section]: {{< ref "/docs/getting-started/futures.md#returning-not-ready" >}}
