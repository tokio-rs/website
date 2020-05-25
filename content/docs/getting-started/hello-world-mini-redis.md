---
title: "Hello world!"
---

This guide assumes that you have some knowledge of the [Rust programming
language] and are using Rust `1.39.0` or higher. To use Tokio with earlier
versions of Rust, please check out the [Tokio 0.1 docs].

To check your version of Rust on the command line:

```bash
rustc --version
rustc 1.39.0 (4560ea788 2019-11-04)
```

In version `1.39.0` [Rust introduced async-await], see the [Async Book] for
in-depth documentation of these new Rust language features. This guide also
seeks to provide a practical, hands-on introduction for all of the Rust language
features that are needed for programming with Tokio.

Also, most readers will have some experience with writing networking code using
the [Rust standard library] or another language, though folks who are new to
network programming should also be able to follow along.

# Introducing asynchronous programming

As our first introduction to [asynchronous programming](../../overview) with
Tokio, we will start with a tiny app that sets the key "hello" and the value
"world!" on a [mini-redis] instance, and then retrieves it.

# Mini-redis

[mini-redis] is an incomplete, idiomatic implementation of a Redis client and server
built with Tokio with the intent to provide a larger example of writing a Tokio application.
We'll be interacting with it in this guide. To install it with cargo, on your Terminal client do:

```bash
cargo install mini-redis
```

# Let's write some code!

Next we'll write some code to instantiate a [mini-redis] client connection and `set` the `"hello"`
key with the `world` value, and then `get`'s it

Let's get started by generating a new Rust app:

```bash
$ cargo new hello-world
$ cd hello-world
```

For a quick start, we'll add the Tokio crate with all Tokio of its features, along with mini-redis to
our Cargo manifest, by adding the following text to `Cargo.toml`.

```toml
[dependencies]
tokio = { version = "0.2", features = ["full"] }
mini-redis = "0.1"
```

Then we'll replace `main.rs` with our "hello world" code:

```rust
use mini_redis::{client, Result};

#[tokio::main]
pub async fn main() -> Result<()> {
    // Open a connection to the mini-redis address.
    let mut client = client::connect("127.0.0.1:6379").await?;

    // Set the key "hello" with value "world"
    client.set("hello", "world".into()).await?;

    // Get key "hello"
    let result = client.get("hello").await?;

    println!("got value from the server; success={:?}", result.is_some());
    Ok(())
}
```

The `#[tokio::main]` macro provides common boilerplate for setting up the tokio
runtime, so that we can write `main()` as an [`async function`]. This enables us
to call asynchronous functions and write sequential code as if they were
blocking by using the Rust `await` keyword, like shown in the set and get instructions.
[`Result`] is used to ease error handling.

# Running
To run our example we first need to start the mini-redis server:

```bash
RUST_LOG=debug server
```

Then we can run our example with:
```bash
RUST_LOG=cargo run
```


# Next steps

Now that we have successfully built a tiny client to get a feel for network
programming with Tokio, we'll dive into more detail about how everything works.

[rust programming language]: https://www.rust-lang.org/
[tokio 0.1 docs]:
  https://v0-1--tokio.netlify.com/docs/getting-started/hello-world/
[rust introduced async-await]:
  https://blog.rust-lang.org/2019/11/07/Async-await-stable.html
[async book]: https://rust-lang.github.io/async-book/index.html
[rust standard library]: https://doc.rust-lang.org/std/net/index.html
[`tcp`]: https://tools.ietf.org/html/rfc793
[`net`]: https://docs.rs/tokio/*/tokio/net/index.html
[`async function`]:
  https://doc.rust-lang.org/reference/items/functions.html#async-functions
[mini-redis]: https://github.com/tokio-rs/mini-redis
[`Result`]: https://github.com/tokio-rs/mini-redis/blob/master/src/lib.rs#L71
