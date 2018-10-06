---
title: "Futures"
weight : 1020
menu:
  docs:
    parent: getting_started
---

Now we will go over the Tokio runtime model and futures. Tokio is built on top of
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

Futures are an abstraction around this polling model. A `Future` represents a value
that will be available at "some point in the future". We can poll the future and
ask if the value is ready or not. Let's take a look in more detail.

# A closer look at futures

A future is a value that represents the completion of an asynchronous
computation. Usually, the future _completes_ due to an event that happens
elsewhere in the system. While we’ve been looking at things from the perspective
of basic I/O, you can use a future to represent a wide range of events, e.g.:

* **A database query** that’s executing in a thread pool. When the query
  finishes, the future is completed, and its value is the result of the query.

* **An RPC invocation** to a server. When the server replies, the future is
  completed, and its value is the server’s response.

* **A timeout**. When time is up, the future is completed, and its value is
  `()`.

* **A long-running CPU-intensive task**, running on a thread pool. When the task
  finishes, the future is completed, and its value is the return value of the
  task.

* **Reading bytes from a socket**. When the bytes are ready, the future is
  completed – and depending on the buffering strategy, the bytes might be
  returned directly, or written as a side-effect into some existing buffer.

The entire point of the future abstraction is to allow asynchronous functions,
i.e., functions that cannot immediately return a value, to be able to return
**something**.

For example, an asynchronous HTTP client could provide a `get` function that
looks like this:

```rust,ignore
pub fn get(&self, uri: &str) -> ResponseFuture { ... }
```

Then, the user of the library would use the function as so:

```rust,ignore
let response_future = client.get("https://www.example.com");
```

Now, the `response_future` isn't the actual response. It is a future that will
complete once the response is received. However, since the caller has a concrete
**thing** (the future), they can start to use it. For example, they may chain
computations to perform once the response is received or they might pass the
future to a function.

```rust,ignore
let response_is_ok = response_future
    .map(|response| {
        response.status().is_ok()
    });

track_response_success(response_is_ok);
```

All of those actions taken with the future don't immediately perform any work.
They cannot because they don't have the actual HTTP response. Instead, they
define the work to be done when the response future completes.

Both the [`futures`] crate and Tokio come with a collection of combinator
functions that can be used to work with futures.

# Poll based Futures

As discussed in the previous section, Rust futures are poll based. This means that
instead of a `Future` being responsible for pushing the data somewhere once it is
complete, it relies on being asked whether it is complete or not. This is a unique
aspect of the Rust future library.  Most future libraries for other programming
languages use a push based model where callbacks are supplied to the future and
the computation invokes the callback immediately with the computation result.

Using a poll based model offers [many advantages], including being a zero cost
abstraction, i.e., using Rust futures has no added overhead compared to writing
the asynchronous code by hand.

We'll take a closer look at this poll based model in the next section.

[many advantages]: https://aturon.github.io/blog/2016/09/07/futures-design/

The `Future` trait is as follows:

```rust,ignore
trait Future {
    /// The type of the value returned when the future completes.
    type Item;

    /// The type representing errors that occurred while processing the
    /// computation.
    type Error;

    fn poll(&mut self) -> Result<Async<Self::Item>, Self::Error>;
}
```

In a future section, we'll be implementing a `Future` from scratch. For now it's just
important to know that Futures have two associated types: `Item` and `Error`. `Item` is
the type of the value that the `Future` will yield when it completes. `Error` is the
type of Error that the `Future` may yield if there's an error before that causes the
`Future` from being able to complete.

Finally, `Future`s have one method named `poll`. We won't go into too much detail
about `poll` in this section since you don't need to know about `poll` to use Futures
with combinators. The only thing to be aware for now is that `poll` is
what the runtime will call in order to see if the `Future` is complete yet or not.

The specific part of the runtime in charge of polling futures is known as the executor.
Which will constantly poll futures and make sure they eventually return a value.

# Executors

In order for a `Future` to make progress, something has to call `poll`.
This is the job of an executor.

Executors are responsible for repeatedly calling `poll` on a `Future` until its value
is returned. There are many different ways to do this. For example, the
[`CurrentThread`] executor will block the current thread and loop through all
spawned tasks, calling poll on them. [`ThreadPool`] schedules tasks across a thread
pool. This is also the default executor used by the [runtime][rt].

All tasks **must** be spawned on an executor or no work will be performed.

And now we have a very high level understanding of Tokio and futures. Futures are
values that represent some value that will be available to us "at some point in the
future". We can combine futures together using combinators to produce another future
in order to sequence work that should be done once the value is available. However,
our future needs something to call `poll` on it in order to drive it to completion.
This something is known as an executor. If we don't give our future to an executor,
nothing will happen.

In the next section, we'll take a look at more involved example than our hello-world
example.

[`futures`]: {{< api-url "futures" >}}
[`notify`]: {{< api-url "futures" >}}/executor/trait.Notify.html#tymethod.notify
[`task::current()`]: {{< api-url "futures" >}}/task/fn.current.html
[`AndThen`]: {{< api-url "futures" >}}/future/struct.AndThen.html
