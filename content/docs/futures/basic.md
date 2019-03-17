---
title: "Implementing futures"
weight : 2020
menu:
  docs:
    parent: futures
---

Implementing futures is very common when using Tokio. Let's start with a very
basic future that performs no asynchronous logic and simply returns a message
(the venerable "hello world").

# The `Future` trait.

The `Future` trait is as follows:

```rust,ignore
trait Future {
    /// The type of the value returned when the future completes.
    type Item;

    /// The type representing errors that occurred while processing the computation.
    type Error;

    /// The function that will be repeatedly called to see if the future is
    /// has completed or not. The `Async` enum can either be `Ready` or
    /// `NotReady` and indicates whether the future is ready to produce
    /// a value or not.
    fn poll(&mut self) -> Result<Async<Self::Item>, Self::Error>;
}
```

Let's implement it for our "hello world" future:

```rust
# #![deny(deprecated)]
extern crate futures;

// `Poll` is a type alias for `Result<Async<T>, E>`
use futures::{Future, Async, Poll};

struct HelloWorld;

impl Future for HelloWorld {
    type Item = String;
    type Error = ();

    fn poll(&mut self) -> Poll<Self::Item, Self::Error> {
        Ok(Async::Ready("hello world".to_string()))
    }
}
```

The `Item` and `Error` associated types define the types returned by the future
once it completes. `Item` is the success value and `Error` is returned when the
future encounters an error while processing. By convention, infallible futures
set `Error` to `()`.

Futures use a poll based model. The consumer of a future repeatedly calls the
`poll` function. The future then attempts to complete. If the future is able to
complete, it returns `Async::Ready(value)`. If the future is unable to complete
due to being blocked on an internal resource (such as a TCP socket), it returns
`Async::NotReady`.

When a future's `poll` function is called, the implementation will
**synchronously** do as much work as possible until it is logically
blocked on some asynchronous event that has not occured yet. The future
implementation then saves its state internally so that the next time
`poll` is called (after an external event is received), it resumes
processing from the point it left off. Work is not repeated.

The hello world future requires no asynchronous processing and is immediately
ready, so it returns `Ok(Async::Ready(value))`.

# Running the future

Tokio is responsible for running futures to completion. This is done by passing
the future to `tokio::run`.

The `tokio::run` accepts futures where both `Item` and `Error` are set to `()`.
This is because Tokio only executes the futures, it does not do anything with
values. The user of Tokio is required to fully process all values in the future.

In our case, let's print the future to STDOUT. We will do that by implementing a
`Display` future.

```rust
# #![deny(deprecated)]
extern crate futures;

use futures::{Future, Async, Poll};
use std::fmt;

struct Display<T>(T);

impl<T> Future for Display<T>
where
    T: Future,
    T::Item: fmt::Display,
{
    type Item = ();
    type Error = T::Error;

    fn poll(&mut self) -> Poll<(), T::Error> {
        let value = match self.0.poll() {
            Ok(Async::Ready(value)) => value,
            Ok(Async::NotReady) => return Ok(Async::NotReady),
            Err(err) => return Err(err),
        };

        println!("{}", value);
        Ok(Async::Ready(()))
    }
}
```

The `Display` takes a future that yields items that can be displayed. When it is
polled, it first tries to poll the inner future. If the inner future is **not
ready** then `Display` cannot complete. In this case, `Display` also returns
`NotReady`.

**`poll` implementations must never return `NotReady` unless they received
`NotReady` by calling an inner future.** This will be explained in more detail
in a later section.

The `Display` future will error when the inner future errors. The error is
bubbled up.

When `HelloWorld` is combined with `Display`, both the `Item` and `Error` types
are `()` and the future can be executed by Tokio:

```rust
# #![deny(deprecated)]
extern crate tokio;
# extern crate futures;
# struct HelloWorld;
# struct Display<T>(T);
# impl<T> futures::Future for Display<T> {
#     type Item = ();
#     type Error = ();
#     fn poll(&mut self) -> futures::Poll<(), ()> {
#         Ok(().into())
#     }
# }

let future = Display(HelloWorld);
tokio::run(future);
```

Running this results in "hello world" being outputted to standard out.

# Cleaning things up

The pattern of waiting on an inner future is common enough that there is a
helper macro: `try_ready!`.

The poll function can be rewritten using the macro as such:

```rust
# #![deny(deprecated)]
#[macro_use]
extern crate futures;

use futures::{Future, Async, Poll};
use std::fmt;

struct Display<T>(T);

impl<T> Future for Display<T>
where
    T: Future,
    T::Item: fmt::Display,
{
    type Item = ();
    type Error = T::Error;

    fn poll(&mut self) -> Poll<(), T::Error> {
        let value = try_ready!(self.0.poll());
        println!("{}", value);
        Ok(Async::Ready(()))
    }
}

# fn main() {}
```
