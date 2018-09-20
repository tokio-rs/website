---
title: "Futures"
weight : 1030
menu:
  docs:
    parent: getting_started
---

Futures, hinted at earlier in the guide, are the building block used to manage
asynchronous logic. They are the underlying asynchronous abstraction used by
Tokio.

The future implementation is provided by the [`futures`] crate. However, for
convenience, Tokio re-exports a number of the types.

# What Are Futures?

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

# Implementing `Future`

Implementing the `Future` is pretty common when using Tokio, so it is important
to be comfortable with it.

As discussed in the previous section, Rust futures are poll based. This is a
unique aspect of the Rust future library. Most future libraries for other
programming languages use a push based model where callbacks are supplied to the
future and the computation invokes the callback immediately with the computation
result.

Using a poll based model offers [many advantages], including being a zero cost
abstraction, i.e., using Rust futures has no added overhead compared to writing
the asynchronous code by hand.

[many advantages]: https://aturon.github.io/blog/2016/09/07/futures-design/

The `Future` trait is as follows:

```rust,ignore
trait Future {
    /// The type of the value returned when the future completes.
    type Item;

    /// The type representing errors that occured while processing the
    /// computation.
    type Error;

    fn poll(&mut self) -> Result<Async<Self::Item>, Self::Error>;
}
```

Usually, when you implement a `Future`, you will be defining a computation that
is a composition of sub (or inner) futures. In this case, the future implementation tries
to call the inner future(s) and returns `NotReady` if the inner futures are not
ready.

The following example is a future that is composed of another future that
returns a `usize` and will double that value:

```rust
# #![deny(deprecated)]
# extern crate futures;
# use futures::*;
pub struct Doubler<T> {
    inner: T,
}

pub fn double<T>(inner: T) -> Doubler<T> {
    Doubler { inner }
}

impl<T> Future for Doubler<T>
where T: Future<Item = usize>
{
    type Item = usize;
    type Error = T::Error;

    fn poll(&mut self) -> Result<Async<usize>, T::Error> {
        match self.inner.poll()? {
            Async::Ready(v) => Ok(Async::Ready(v * 2)),
            Async::NotReady => Ok(Async::NotReady),
        }
    }
}
# pub fn main() {}
```

When the `Doubler` future is polled, it polls its inner future. If the inner
future is not ready, the `Doubler` future returns `NotReady`. If the inner
future is ready, then the `Doubler` future doubles the return value and returns
`Ready`.

Because the matching pattern above is common, the [`futures`] crate provides a
macro: `try_ready!`. It is similar to `try!` or `?`, but it also returns on
`NotReady`. The above `poll` function can be rewriten using `try_ready!` as
follows:

```rust
# #![deny(deprecated)]
# #[macro_use]
# extern crate futures;
# use futures::*;
# pub struct Doubler<T> {
#     inner: T,
# }
#
# impl<T> Future for Doubler<T>
# where T: Future<Item = usize>
# {
#     type Item = usize;
#     type Error = T::Error;
#
fn poll(&mut self) -> Result<Async<usize>, T::Error> {
    let v = try_ready!(self.inner.poll());
    Ok(Async::Ready(v * 2))
}
# }
# pub fn main() {}
```

# Returning `NotReady`

The last section handwaved a bit and said that once a Future transitioned to the
ready state, the executor is notifed. This enables the executor to be efficient
in scheduling tasks.

When a function returns Async::NotReady, it signals that it is currently not in
a ready state and is unable to complete the operation. It is critical that the
executor is notified when the state transitions to "ready". Otherwise, the task
will hang infinitely, never getting run again.

For most future implementations, this is done transitively. When a future
implementation is a combination of sub futures, the outer future only returns
`NotReady` when at least one inner future returned `NotReady`. Thus, the outer
future will transition to a ready state once the inner future transitions to a
ready state. In this case, the `NotReady` contract is already satisfied as the
inner future will notify the executor when it becomes ready.

Innermost futures, sometimes called "resources", are the ones responsible for
notifying the executor. This is done by calling [`notify`] on the task returned
by [`task::current()`].

We will be exploring implementing resources and the task system in more depth in
a later section. The key take away here is **do not return `NotReady` unless you
got `NotReady` from an inner future**.

# A More Complicated Future

Let's look at a slightly more complicated future implementation. In this case, we
will implement a future that takes a host name, does DNS resolution, then
establishes a connection to the remote host. We assume a `resolve` function
exists that looks like this:

```rust,ignore
pub fn resolve(host: &str) -> ResolveFuture;
```

where `ResolveFuture` is a future returning a `SocketAddr`.

The steps to implement the future are:

1. Call `resolve` to get a `ResolveFuture` instance.
2. Call `ResolveFuture::poll` until it returns a `SocketAddr`.
3. Pass the `SocketAddr` to `TcpStream::connect`.
4. Call `ConnectFuture::poll` until it returns the `TcpStream`.
5. Complete the outer future with the `TcpStream`.

We will use an `enum` to track the state of the future as it advances through
these steps.

```rust
# extern crate tokio;
# use tokio::net::ConnectFuture;
# pub struct ResolveFuture;
enum State {
    // Currently resolving the host name
    Resolving(ResolveFuture),

    // Establishing a TCP connection to the remote host
    Connecting(ConnectFuture),
}
# pub fn main() {}
```

And the `ResolveAndConnect` future is defined as:

```rust
# pub struct State;
pub struct ResolveAndConnect {
    state: State,
}
```

Now, the implementation:

```rust
# #![deny(deprecated)]
# #[macro_use]
# extern crate futures;
# extern crate tokio;
# use tokio::net::{ConnectFuture, TcpStream};
# use futures::prelude::*;
# use std::io;
# pub struct ResolveFuture;
# enum State {
#     Resolving(ResolveFuture),
#     Connecting(ConnectFuture),
# }
# fn resolve(host: &str) -> ResolveFuture { unimplemented!() }
# impl Future for ResolveFuture {
#     type Item = ::std::net::SocketAddr;
#     type Error = io::Error;
#     fn poll(&mut self) -> Poll<Self::Item, Self::Error> {
#         unimplemented!();
#     }
# }
#
# pub struct ResolveAndConnect {
#     state: State,
# }
pub fn resolve_and_connect(host: &str) -> ResolveAndConnect {
    let state = State::Resolving(resolve(host));
    ResolveAndConnect { state }
}

impl Future for ResolveAndConnect {
    type Item = TcpStream;
    type Error = io::Error;

    fn poll(&mut self) -> Result<Async<TcpStream>, io::Error> {
        use self::State::*;

        loop {
            let addr = match self.state {
                Resolving(ref mut fut) => {
                    try_ready!(fut.poll())
                }
                Connecting(ref mut fut) => {
                    return fut.poll();
                }
            };

            // If we reach here, the state was `Resolving`
            // and the call to the inner Future returned `Ready`
            let connecting = TcpStream::connect(&addr);
            self.state = Connecting(connecting);
        }
    }
}
# pub fn main() {}
```

This illustrates how `Future` implementations are state machines. This future
can be in either of two states:

1. Resolving
2. Connecting

Each time `poll` is called, we try to advance the state machine to the next
state.

Now, the future is basically a re-implementation of the combinator [`AndThen`], so we would
probably just use that combinator.

```rust
# #![deny(deprecated)]
# #[macro_use]
# extern crate futures;
# extern crate tokio;
# use tokio::net::{ConnectFuture, TcpStream};
# use futures::prelude::*;
# use std::io;
# pub struct ResolveFuture;
# fn resolve(host: &str) -> ResolveFuture { unimplemented!() }
# impl Future for ResolveFuture {
#     type Item = ::std::net::SocketAddr;
#     type Error = io::Error;
#     fn poll(&mut self) -> Poll<Self::Item, Self::Error> {
#         unimplemented!();
#     }
# }
# pub fn dox(my_host: &str) {
# let _ =
resolve(my_host)
    .and_then(|addr| TcpStream::connect(&addr))
# ;
# }
# pub fn main() {}
```

This is much shorter and does the same thing.

[`futures`]: {{< api-url "futures" >}}
[`notify`]: {{< api-url "futures" >}}/executor/trait.Notify.html#tymethod.notify
[`task::current()`]: {{< api-url "futures" >}}/task/fn.current.html
[`AndThen`]: {{< api-url "futures" >}}/future/struct.AndThen.html
