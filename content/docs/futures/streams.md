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

# Fibonacci

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

## Getting asynchronous

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

# Combinators

Just like futures, streams come with a number of combinators for reducing
boilerplate. Many of these combinators exist as functions on the
[`Stream`][trait-dox] trait.

Updating fibonacci stream can be rewritten using the [`unfold`] function:

```rust
extern crate futures;

use futures::{stream, Stream};

fn fibonacci() -> impl Stream<Item = u64, Error = ()> {
    stream::unfold((1, 1), |(curr, next)| {
        let new_next = curr + next;

        Some(Ok((curr, (next, new_next))))
    })
}
```

Just like with futures, using stream combinators requires a functional style of
programming. Also, `impl Stream` is used to return the stream from the function.
The [returning futures] strategies apply equality to returning streams.

`Display10` is reimplemented using [`take`] and [`for_each`]:

```rust
extern crate tokio;
extern crate futures;

use futures::Stream;
# use futures::stream;
# fn fibonacci() -> impl Stream<Item = u64, Error = ()> {
# stream::once(Ok(1))
# }

tokio::run(
    fibonacci().take(10)
        .for_each(|num| {
            println!("{}", num);
            Ok(())
        })
);
```

The [`take`] combinator limits the fibonacci stream to 10 values. The [`for_each`]
combinator asynchronously iterates the stream values. [`for_each`] consumes the
stream and returns a future that completes once the closure was called once for
each stream value. It is the asynchronous equivalent to a rust `for` loop.

# Essential combinators

It is worth spending some time with the [`Stream` trait][trait-dox] and
[module][mod-dox] documentation to gain some familiarity with the full set of
available combinators. This guide will provide a very quick overview.

## Concrete streams

The [`stream` module][mod-dox] contains functions for converting values and
iterators into streams.

- [`once`] converts the provided value into an immediately ready stream that
  yields a single item: the provided value.
- [`iter_ok`] and [`iter_result`] both take [`IntoIterator`] values and converts
  them to an immediately ready stream that yields the iterator values.
- [`empty`] returns a stream that immediately yields `None`.

For example:

```rust
extern crate tokio;
extern crate futures;

use futures::{stream, Stream};

let values = vec!["one", "two", "three"];

tokio::run(
    stream::iter_ok(values).for_each(|value| {
        println!("{}", value);
        Ok(())
    })
)
```

## Adapters

Like [`Iterator`], the `Stream` trait includes a broad range of "adapter"
methods. These methods all consume the stream, returning a new stream providing
the requested behavior. Using these adapter combinators, it is possible to:

* Change the type of a stream ([`map`], [`map_err`], [`and_then`]).
* Handle stream errors ([`or_else`]).
* Filter stream values ([`take`], [`take_while`], [`skip`], [`skip_while`],
  [`filter`], [`filter_map`]).
* Asynchronously iterate the values ([`for_each`], [`fold`]).
* Combine multiple streams together ([`zip`], [`chain`], [`select`]).

[interval]: https://docs.rs/tokio/0.1/tokio/timer/struct.Interval.html
[trait-dox]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html
[mod-dox]: https://docs.rs/futures/0.1/futures/stream/index.html
[`unfold`]: https://docs.rs/futures/0.1/futures/stream/fn.unfold.html
[`take`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.take
[`for_each`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.for_each
[returning futures]: {{< ref "/docs/futures/combinators.md#returning-futures" >}}#
[`once`]: https://docs.rs/futures/0.1/futures/stream/fn.once.html
[`iter_ok`]: https://docs.rs/futures/0.1/futures/stream/fn.iter_ok.html
[`iter_result`]: https://docs.rs/futures/0.1/futures/stream/fn.iter_result.html
[`empty`]: https://docs.rs/futures/0.1/futures/stream/fn.empty.html
[`IntoIterator`]: https://doc.rust-lang.org/std/iter/trait.IntoIterator.html
[`Iterator`]: https://doc.rust-lang.org/std/iter/trait.Iterator.html
[`map`]: #
[`map_err`]: #
[`and_then`]: #
[`or_else`]: #
[`filter`]: #
[`filter_map`]: #
[`for_each`]: #
[`fold`]: #
[`take`]: #
[`take_while`]: #
[`skip`]: #
[`skip_while`]: #
[`zip`]: #
[`chain`]: #
[`select`]: #
