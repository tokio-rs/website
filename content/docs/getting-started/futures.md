---
title: "async fn"
weight : 1020
menu:
  docs:
    parent: getting_started
---

Let's take a closer look at Rust's `async fn` feature. Tokio is built on top of
Rust's asynchronous model. This allows Tokio to interop with other libraries
also using the [`futures`] crate.

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

```rust,no_run
# use std::io::prelude::*;
# use std::net::TcpStream;
# fn main() {
let mut socket = TcpStream::connect("127.0.0.1:8080").unwrap();
let mut buf = [0; 1024];
let n = socket.read(&mut buf).unwrap();

// Do something with &buf[..n];
# drop(n);
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

With non-blocking sockets, instead of blocking the thread and waiting on data to
arrive, the thread is able to perform **other** work. Once data arrives on the
socket, the operating system sends a notification to the process, the process
tries to read from the socket again, and this time, there is data.

This I/O model is provided by [mio], a low level, non-blocking I/O library for
Rust. The problem with using Mio is that applications written to use Mio
directly tend to require a high amount of complexity. The application must
maintain large state machines tracking the state in which the application
currently is in. Once an operating system notification arrives, the application
takes action (tries to read from a socket) and updates its state accordingly.

# `async fn`

Rust's `async fn` feature allows the programmer to write their application using
synchronous logic flow: the flow of the code matches the flow of execution, i.e.
similar to writing synchronous code. The compiler will then transform the code
to generate the state machines needed to use non-blocking sockets.

When calling an `async fn`, such as `TcpStream::connect`, instead of blocking
the current thread waitin for completion, a value representing the computation
is immediately returned. This value implements the [`Future`] trait. There is no
guarantee as to when or where the computation will happen. The computation may
happen immediately or it may be lazy (it usually is lazy). When the caller
wishes to receive the result of the computation, `.await` is called on the
future. The flow of execution stops until the `Future` completes and `.await`
returns the result.

When the program is compiled, Rust finds all the `.await` calls and transforms
the `async fn` into a state machine (kind of like a big `enum` with a variant
for each `.await`).

The Tokio runtime is responsible for driving all the `async fn`s in an
application to completion.

# A closer look at futures

As hinted above, `async fn` calls return instances of [`Future`], but what is a
future?

A future is a value that represents the completion of an asynchronous
computation. Usually, the future _completes_ due to an event that happens
elsewhere in the system (I/O event from the operating system, a timer elapsing,
receiving a message on a channel, ...).

As hinted at earlier, the Rust asynchronous model is very different than that of
other languages. Most other languages use a "completion" based model, usually
built using some form of callbacks. In this case, when an asynchronous action is
started, it is submitted with a function to call once the operation completes.
When the process receives the I/O notification from the operating system, it
finds the function associated with it and calls it immediately. This is a
**push** based model because the value is **pushed** into the callback.

The rust asynchronous model uses a **pull** based model. Instead of a `Future`
being responsible for pushing the data into a callback, it relies on **something
else** asking it it is complete or not. In the case of Tokio, that **something
else** is the Tokio runtime.

Using a poll based model offers [many advantages], including being a zero cost
abstraction, i.e., using Rust futures has no added overhead compared to writing
the asynchronous code by hand.

We'll take a closer look at this poll based model in the next section.

[many advantages]: https://aturon.github.io/blog/2016/09/07/futures-design/

## The Future trait

The `Future` trait is as follows:

```rust,no_run
use std::pin::Pin;
use std::task::{Context, Poll};

pub trait Future {
    /// The type of value produced on completion.
    type Output;

    /// Attempt to resolve the future to a final value, registering
    /// the current task for wakeup if the value is not yet available.
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}
# fn main() {}
```

For now it's just important to know that futures have an associated type,
`Output`, which is the type yielded when the future completes. The `poll`
function is the function that the Tokio runtime calls to check if the future is
complete.

[`Future`]: https://doc.rust-lang.org/std/future/trait.Future.html
[`futures`]: https://docs.rs/futures
[standard library]: https://doc.rust-lang.org/std/
[c10k]: https://en.wikipedia.org/wiki/C10k_problem
[mio]: https://github.com/tokio-rs/mio
