+++
date = "2018-08-27"
title = "Experimental async / await support for Tokio"
description = "August 27, 2018"
menu = "blog"
weight = 991
+++

Happy Monday!

In case you haven't heard, `async` / `await` is a big new feature that is being
worked on for Rust. It aims to make asynchronous programming easy (well, at
least a little bit easier than it is today). The work has been on going for a
while and is already usable today on the Rust nightly channel.

I'm happy to announce that Tokio now has experimental async / await support!
Let's dig in a bit.

## Getting started

First, Tokio async/await support is provided by a new crate, creatively named
[`tokio-async-await`]. This crate is a shim on top of `tokio`. It contains all of
the same types and functions as `tokio` (as re-exports) as well as additional
helpers to work with `async` / `await`.

To use [`tokio-async-await`], you need to depend on it from a crate that is
configured to use Rust's 2018 edition. It also only works with recent Rust
nightly releases.

In your application's `Cargo.toml`, add the following:

```toml
# At the very top of the file
cargo-features = ["edition"]

# In the `[packages]` section
edition = "2018"

# In the `[dependencies]` section
tokio = {version = "0.1", features = ["async-await-preview"]}
```

Then, in your application, do the following:

```rust,ignore
// The nightly features that are commonly needed with async / await
#![feature(await_macro, async_await, futures_api)]

// This pulls in the `tokio-async-await` crate. While Rust 2018
// doesn't require `extern crate`, we need to pull in the macros.
#[macro_use]
extern crate tokio;

fn main() {
    // And we are async...
    tokio::run_async(async {
        println!("Hello");
    });
}
```

and run it (with nightly):

```txt
cargo +nightly run
```

and you are using Tokio + `async` / `await`!

Note that, to spawn `async` blocks, the `tokio::run_async` function should be
used (instead of `tokio::run`).

## Going deeper

Now, let's build something simple: an echo server (yay).

```rust,ignore
// Somewhere towards the top

#[macro_use]
extern crate tokio;

use tokio::net::{TcpListener, TcpStream};
use tokio::prelude::*;

// more to come...

// The main function
fn main() {
  let addr: SocketAddr = "127.0.0.1:8080".parse().unwrap();
  let listener = TcpListener::bind(&addr).unwrap();

    tokio::run_async(async {
        let mut incoming = listener.incoming();

        while let Some(stream) = await!(incoming.next()) {
            let stream = stream.unwrap();
            handle(stream);
        }
    });
}
```

In this example, `incoming` is a stream of accepted `TcpStream` values. We are
using `async` / `await` to iterate the stream. Currently, there is only syntax
for awaiting on a single value (future), so we use the `next` combinator to get
a future of the next value in the stream. This lets us iterate the stream with
`while` syntax.

Once we get the stream, it is passed to the `handle` function to process. Lets
see how that is implemented.

```rust,ignore
fn handle(mut stream: TcpStream) {
    tokio::spawn_async(async move {
        let mut buf = [0; 1024];

        loop {
            match await!(stream.read_async(&mut buf)).unwrap() {
                0 => break, // Socket closed
                n => {
                    // Send the data back
                    await!(stream.write_all_async(&buf[0..n])).unwrap();
                }
            }
        }
    });
}
```

Just like `run_async`, there is a `spawn_async` function to spawn async blocks
as tasks.

Then, to perform the echo logic, we read from the socket into a buffer and
write the data back to the same socket. Because we are using `async` / `await`,
we can use an array that looks stack allocated (it actually ends up in the
heap).

Note that `TcpStream` has `read_async` and `write_all_async` functions. These
functions perform the same logic as the synchronous equivalents that exist on the
`Read` and `Write` traits in `std`. The difference, they return futures that can
be awaited on.

The `*_async` functions are defined in the `tokio-async-await` crate by using
extension traits. These traits got imported with the `use tokio::prelude::*;`
line.

This is just a start, check the [examples] directory in the repository for more.
There even is one using [hyper].

## Some notes

First, the `tokio-async-await` crate only provides compatibility for `async` /
`await` syntax. It does **not** provide support for the `futures` 0.3 crate. It
is expected that users continue using futures 0.1 to remain compatible with
Tokio.

To make this work, the `tokio-async-await` crate defines its own `await!` macro.
This macro is a shim on top of the one provided by `std` that enables waiting
for `futures` 0.1 futures. This is how the compatibility layer is able to stay
**lightweight** and **boilerplate** free.

This is just a start. The `async` / `await` support will continue to evolve and
improve over time, but this is enough to get everyone going!

And with that, have a great week!

<div style="text-align:right">&mdash;Carl Lerche</div>

[`tokio-async-await`]: https://crates.io/crates/tokio-async-await
[examples]: https://github.com/tokio-rs/tokio/blob/master/tokio-async-await/examples
[hyper]: https://github.com/tokio-rs/tokio/blob/master/tokio-async-await/examples/src/hyper.rs
