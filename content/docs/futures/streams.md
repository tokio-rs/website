---
title: "Streams"
weight : 2050
menu:
  docs:
    parent: futures
    identifier: "futures/runtime-model"
---

Streams are similar to futures, but instead of yielding a single value, they
asynchronously yield one or more values. They can be thought of as asynchronous
iterators.

Just like futures, streams are able to represent a wide range of things as long
as those things produce discrete values at different points sometime in the
future. For instance:

* **UI Events** caused by the user interacting with a GUI in different ways. When an
  event happens the stream yields a different message to your app over time.
* **Push Notifications from a server**. Sometimes a request/response model is not
  what you need. A client can establish a notification stream with a server to be
  able to receive messages from the server without specifically being requested.
* **Incoming socket connections**. As different clients connect to a server, the
  connections stream will yield socket connections.

# The `Stream` trait

Just like `Future`, implementing `Stream` is common when using Tokio. The
`Stream` trait is as follows:

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

The `Item` associated type is the type yielded by the stream. The `Error`
associated type is the type of the error yielded when something unexpected
happens. The `poll` function is very similar to `Future`'s `poll` function. The
only difference is that, this time, `Option<Self::Item>` is returned.

Stream implementations have the `poll` function called many times. When the next
value is ready, `Ok(Async::Ready(Some(value)))` is returned. When the stream is
**not ready** to yield a value, `Ok(Async::NotReady)` is returned. When the
stream is exhausted and will yield no further values, `Ok(Async::Ready(None))`
is returned. Just like with futures, streams **must not** return
`Async::NotReady` unless `Async::NotReady` was obtained by an inner stream or
future.

When the stream encounters an error, `Err(error)` is returned. Returning an
error **does not** signify that the stream is exhausted. The error may be
transient and the caller may try calling `poll` again in the future and values
may be produced again. If the error is fatal, then the next call to `poll`
should return `Ok(Async::Ready(None))`.

The following example shows how to implement the fibonacci sequence as a stream.

```rust
extern crate futures;

use futures::{Stream, Poll, Async};

pub struct Fibonacci {
    curr: u64,
    next: u64,
}

impl Fibonacci {
    fn new() -> Fibonacci {
        Fibonacci {
            curr: 1,
            next: 1,
        }
    }
}

impl Stream for Fibonacci {
    type Item = u64;

    // The stream will never yield an error
    type Error = ();

    fn poll(&mut self) -> Poll<Option<u64>, ()> {
        let curr = self.curr;
        let next = curr + self.next;

        self.curr = self.next;
        self.next = next;

        Ok(Async::Ready(Some(curr)))
    }
}
```

To use the stream, a future must be built that consumes it. The following future
will take a stream and display 10 items from it.

```rust
#[macro_use]
extern crate futures;

use futures::{Future, Stream, Poll, Async};
use std::fmt;

pub struct Display10<T> {
    stream: T,
    curr: usize,
}

impl<T> Display10<T> {
    fn new(stream: T) -> Display10<T> {
        Display10 {
            stream,
            curr: 0,
        }
    }
}

impl<T> Future for Display10<T>
where
    T: Stream,
    T::Item: fmt::Display,
{
    type Item = ();
    type Error = T::Error;

    fn poll(&mut self) -> Poll<(), Self::Error> {
        while self.curr < 10 {
            let value = match try_ready!(self.stream.poll()) {
                Some(value) => value,
                // There were less than 10 values to display, terminate the
                // future.
                None => break,
            };

            println!("value #{} = {}", self.curr, value);
            self.curr += 1;
        }

        Ok(Async::Ready(()))
    }
}
# fn main() {}
```

Now, the fibonacci sequence can be displayed:

```rust
extern crate tokio;
# extern crate futures;
# struct Fibonacci;
# impl Fibonacci { fn new() { } }
# struct Display10<T> { v: T };
# impl<T> Display10<T> {
# fn new(_: T) -> futures::future::FutureResult<(), ()> {
# futures::future::ok(())
# }
# }

let fib = Fibonacci::new();
let display = Display10::new(fib);

tokio::run(display);
```

So far, the fibonacci stream is synchronous. Lets make it asynchronous by
waiting a second between values. To do this,
[`tokio::timer::Interval`][interval] is used. `Interval` is, itself, a stream
that yields `()` values at the requested time interval. Calling `Interval::poll`
between intervals results in `Async::NotReady` being returned.

The `Fibonacci` stream is updated as such:

```rust
#[macro_use]
extern crate futures;
extern crate tokio;

use tokio::timer::Interval;
use futures::{Stream, Poll, Async};
use std::time::Duration;

pub struct Fibonacci {
    interval: Interval,
    curr: u64,
    next: u64,
}

impl Fibonacci {
    fn new(duration: Duration) -> Fibonacci {
        Fibonacci {
            interval: Interval::new_interval(duration),
            curr: 1,
            next: 1,
        }
    }
}

impl Stream for Fibonacci {
    type Item = u64;

    // The stream will never yield an error
    type Error = ();

    fn poll(&mut self) -> Poll<Option<u64>, ()> {
        // Wait until the next interval
        try_ready!(
            self.interval.poll()
                // The interval can fail if the Tokio runtime is unavailable.
                // In this example, the error is ignored.
                .map_err(|_| ())
        );

        let curr = self.curr;
        let next = curr + self.next;

        self.curr = self.next;
        self.next = next;

        Ok(Async::Ready(Some(curr)))
    }
}
# fn main() {}
```

The `Display10` future already supports asynchronicity so it does not need to be
updated.

To run the throttled fibonacci sequence, include an interval:

```rust
extern crate tokio;
# extern crate futures;
# struct Fibonacci;
# impl Fibonacci { fn new(dur: Duration) { } }
# struct Display10<T> { v: T };
# impl<T> Display10<T> {
# fn new(_: T) -> futures::future::FutureResult<(), ()> {
# futures::future::ok(())
# }
# }

use std::time::Duration;

let fib = Fibonacci::new(Duration::from_secs(1));
let display = Display10::new(fib);

tokio::run(display);
```

[interval]: https://docs.rs/tokio/0.1/tokio/timer/struct.Interval.html
