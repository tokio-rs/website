---
title: "Futures"
weight : 1020
menu:
  docs:
    parent: getting_started
---

Let's take a closer look at futures. Tokio is built on top of the [`futures`] crate
and uses its runtime model. This allows Tokio to interop with other libraries also
using the [`futures`] crate.

**Note**: This runtime model is very different than async libraries found in
other languages. While, at a high level, APIs can look similar, the way code
gets executed differs.

We'll be taking a closer look at the runtime in the upcoming sections, but a
basic understanding of the runtime is necessary to understand futures. To gain
this understanding, we'll first look at the synchronous model that Rust uses by
default and see how this differs from Tokio's asynchronous model.

# Synchronous Model

First, let's talk briefly about the synchronous (or blocking) model that the
Rust [standard library] uses.

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
buffer or it does not. If there is pending data, the call to `read` will return
immediately and `buf` will be filled with that data. However, if there is no
pending data, the `read` function will block the current thread until data is
received. Once the data is received, `buf` will be filled with this newly received
data and the `read` function will return.

In order to perform reads on many different sockets concurrently, a thread per
socket is required. Using a thread per socket does not scale up very well to
large numbers of sockets. This is known as the [c10k] problem.

# Non-blocking sockets

The way to avoid blocking a thread when performing an operation like read is to
not block the thread! Non-blocking sockets allow performing operations, like read,
without blocking the thread. When the socket has no pending data in its receive
buffer, the `read` function returns immediately, indicating that the socket was "not
ready" to perform the read operation.

When using a Tokio [`TcpStream`], a call to `read` will always immediately return
a value ([`ErrorKind::WouldBlock`]) even if there is no pending data to read.
If there is no pending data, the caller is responsible for calling `read` again
at a later time.  The trick is to know when that "later time" is.

Another way to think about a non-blocking read is as 'polling' the socket for
data to read.

Futures are an abstraction around this polling model. A `Future` represents a value
that will be available at "some point in the future". We can poll the future and
ask if the value is ready or not. Let's take a look in more detail.

# A closer look at futures

A future is a value that represents the completion of an asynchronous
computation. Usually, the future _completes_ due to an event that happens
elsewhere in the system. While we’ve been looking at things from the perspective
of basic I/O, you can use a future to represent a wide range of events, e.g.:

* **A database query**, when the query finishes, the future is completed, and
  its value is the result of the query.

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
**value** (the future), they can start to use it. For example, they may chain
computations using combinators to perform once the response is received or they
might pass the future to a function.

```rust,ignore
let response_is_ok = response_future
    .map(|response| {
        response.status().is_ok()
    });

track_response_success(response_is_ok);
```

None of those actions taken with the future perform any immediate work.
They cannot because they don't have the actual HTTP response. Instead, they
define the work to be done when the response future completes and the actual
response is available.

Both the [`futures`] crate and Tokio come with a collection of combinator
functions that can be used to work with futures. So far we've seen `and_then` which
chains two [`futures`] together, `then` which allows to chain a future to a previous
one even if the previous one errored, and `map` which simply maps a future's value
from one type to another.

We'll be exploring more combinators later in this guide.

# Poll based Futures

As hinted at earlier, Rust futures are poll based. This means that instead of a
`Future` being responsible for pushing the data somewhere once it is complete, it
relies on being asked whether it is complete or not.

This is a unique aspect of the Rust future library. Most future libraries for other
programming languages use a push based model where callbacks are supplied to the
future and the computation invokes the callback immediately with the computation
result.

Using a poll based model offers [many advantages], including being a zero cost
abstraction, i.e., using Rust futures has no added overhead compared to writing
the asynchronous code by hand.

We'll take a closer look at this poll based model in the next section.

[many advantages]: https://aturon.github.io/blog/2016/09/07/futures-design/

## The Future trait

The `Future` trait is as follows:

```rust,ignore
trait Future {
    /// The type of the value returned when the future completes.
    type Item;

    /// The type representing errors that occurred while processing the computation.
    type Error;

    /// The function that will be repeatedly called to see if the future
    /// has completed or not
    fn poll(&mut self) -> Result<Async<Self::Item>, Self::Error>;
}
```

For now it's just important to know that futures have two associated types: `Item`
and `Error`. `Item` is the type of the value that the `Future` will yield when it
completes. `Error` is the type of Error that the `Future` may yield if there's an
error before that causes the `Future` from being able to complete.

Finally, `Future`s have one method named `poll`. We won't go into too much detail
about `poll` in this section since you don't need to know about `poll` to use
futures with combinators. The only thing to be aware for now is that `poll` is
what the runtime will call in order to see if the `Future` is complete yet or not.
If you're curious: `Async` is an enum with values `Ready(Item)` or `NotReady` which
informs the runtime of if the future is complete or not.

In a future section, we'll be implementing a `Future` from scratch including writing
a poll function that properly informs the runtime when the future is complete.

## Streams

Streams are the iterator equivalent of futures. Instead of yielding a value at some
point in the future, streams yield a collection of values each at some point in the
future. In other words, streams don't yield just one value at one point in the
future like futures do. They rather keep yielding values over time.

Just like futures, you can use streams to represent a wide range of things as long
as those things produce discrete values at different points sometime in the future.
For instance:

* **UI Events** caused by the user interacting with a GUI in different ways. When an
  event happens the stream yields a different message to your app over time.
* **Push Notifications from a server**. Sometimes a request/response model is not
  what you need. A client can establish a notification stream with a server to be
  able to receive messages from the server without specifically being requested.
* **Incoming socket connections**. As different clients connect to a server, the
  connections stream will yield socket connections.

Streams are very similar to futures in their implementation:

```rust,ignore
trait Stream {
    /// The type of the value yielded by the stream.
    type Item;

    /// The type representing errors that occurred while processing the computation.
    type Error;

    /// The function that will be repeatedly called to see if the stream has
    /// another value it can yield
    fn poll(&mut self) -> Poll<Option<Self::Item>, Self::Error>;
}
```

Streams come with their own set of combinators and will be covered in more depth
in the [working with futures][working-with-streams] section.

[`futures`]: {{< api-url "futures" >}}
[standard library]: https://doc.rust-lang.org/std/
[c10k]: https://en.wikipedia.org/wiki/C10k_problem
[`TcpStream`]: {{< api-url "tokio" >}}/net/struct.TcpStream.html
[`ErrorKind::WouldBlock`]: https://doc.rust-lang.org/std/io/enum.ErrorKind.html#variant.WouldBlock
[working-with-streams]: {{< ref "/docs/futures/streams.md" >}}
