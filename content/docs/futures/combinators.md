---
title: "Combinators"
weight : 2040
menu:
  docs:
    parent: futures
---

Often times, Future implementations follow similar patterns. To help reduce
boilerplate, the `futures` crate provides a number of utilities, called
"combinators", that abstract these patterns. Many of these combinators exist as
functions on the [`Future`] trait.

# Building blocks

Let's revisit the future implementations from the previous pages and see how
they can be simplified by using combinators.

## `map`

The [`map`] combinator takes a future and returns a new future that applies a
function to the value yielded by the first future.

This was the `Display` future [`previously`][display-fut] implemented:

```rust
# #![deny(deprecated)]
# #[macro_use]
# extern crate futures;
# extern crate tokio;
#
# use futures::{Future, Async, Poll};
# use std::fmt;
#
# struct Display<T>(T);
#
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

fn main() {
# let HelloWorld = futures::future::ok::<_, ()>("hello");
    let future = Display(HelloWorld);
    tokio::run(future);
}
```

With the `map` combinator, it becomes:

```rust
# #![deny(deprecated)]
extern crate tokio;
extern crate futures;

use futures::Future;

fn main() {
# let HelloWorld = futures::future::ok::<_, ()>("hello");
    let future = HelloWorld.map(|value| {
        println!("{}", value);
    });

    tokio::run(future);
}
```

This is how `map` is implemented:

```rust
# #![deny(deprecated)]
# #[macro_use]
# extern crate futures;
# use futures::{Future, Async, Poll};
pub struct Map<A, F> where A: Future {
    future: A,
    f: Option<F>,
}

impl<U, A, F> Future for Map<A, F>
    where A: Future,
          F: FnOnce(A::Item) -> U,
{
    type Item = U;
    type Error = A::Error;

    fn poll(&mut self) -> Poll<U, A::Error> {
        let value = try_ready!(self.future.poll());
        let f = self.f.take().expect("cannot poll Map twice");

        Ok(Async::Ready(f(value)))
    }
}
# fn main() {}
```

Comparing `Map` with our `Display` implementation, it is clear how they both are
very similar. Where `Display` calls `println!`, `Map` passes the value to the
function.

## `and_then`

Now, let's use combinators to rewrite the future that established a TCP stream
and wrote "hello world" to the peer using the `and_then` combinator.

The `and_then` combinator allows sequencing two asynchronous operations. Once
the first operation completes, the value is passed to a function. The function
uses that value to produce a new future and that future is then executed. The
difference between `and_then` and `map` is that `and_then`'s function returns a
future where as `map's function returns a value.

The original implementation is found [here][connect-and-write]. Once updated to
use combinators, it becomes:

```rust
# #![deny(deprecated)]
extern crate tokio;
extern crate bytes;
extern crate futures;

use tokio::io;
use tokio::net::TcpStream;
use futures::Future;

fn main() {
    let addr = "127.0.0.1:1234".parse().unwrap();

    let future = TcpStream::connect(&addr)
        .and_then(|socket| {
            io::write_all(socket, b"hello world")
        })
        .map(|_| println!("write complete"))
        .map_err(|_| println!("failed"));

// # let future = futures::future::ok::<(), ()>(());
    tokio::run(future);
}
```

Further computations may be sequenced by chaining calls to `and_then`. For
example:

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate bytes;
# extern crate futures;
#
# use tokio::io;
# use tokio::net::TcpStream;
# use futures::Future;

fn main() {
    let addr = "127.0.0.1:1234".parse().unwrap();

    let future = TcpStream::connect(&addr)
        .and_then(|socket| {
            io::write_all(socket, b"hello world")
        })
        .and_then(|(socket, _)| {
            // read exactly 11 bytes
            io::read_exact(socket, vec![0; 11])
        })
        .and_then(|(socket, buf)| {
            println!("got {:?}", buf);
            Ok(())
        });

# let future = futures::future::ok::<(), ()>(());
    tokio::run(future);
}
```

The future returned by `and_then` executes identically to the future we
implemented by hand on the previous page.

# Essential combinators

TODO

# When to use combinators

TODO:

* Cannot be named (in some cases).
* Cannot borrow.
* Full functional.

[`map`]: #
[display-fut]: #
[connect-and-write]: #
[`Future`]: #
