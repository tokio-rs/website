---
title: "Hello World!"
weight : 1010
menu:
  docs:
    parent: getting_started
---

To kick off our tour of Tokio, we will start with a tiny client app. We'll
connect to a socket via TCP and write "hello, world!" 

Let's get started by generating a new Rust app:

```bash
$ cargo new hello-world
$ cd hello-world
```

We'll add all Tokio features as `Cargo.toml` dependencies for a quick start:

```toml
[dependencies]
tokio = { version = "0.2", features = ["full"] }
```

Then replace `main.rs` with our "hello world" code:

```rust
# #![deny(deprecated)]
# #![allow(unused_imports)]

use tokio::net::TcpStream;
use tokio::prelude::*;

#[tokio::main]
async fn main() {
    let mut stream = TcpStream::connect("127.0.0.1:6142").await.unwrap();
    println!("created stream");

    let result = stream.write(b"hello world\n").await;
    println!("wrote to stream; success={:?}", result.is_ok());
}
```

We `use` Tokio's [`net`] module, which provides the same
abstraction over networking as the corresponding modules in
`std` except asynchronously. 

The `#[tokio::main]` macro provides common boilerplate for setting up the
tokio runtime, so that we can write `main()` as an [`async function`]. This
enables us to call asynchronous functions and write sequential code as if
they were blocking by using the Rust `await` keyword. (See the [Async Book](https://rust-lang.github.io/async-book/index.html) for in-depth documentation of 
Rust language features.)

# Running our app

Our app connects to a socket over TCP and writes to it. An easy way to listen
on a socket is with the network utility `socat`. The following command listens
on localhost 6142 for a TCP connection and then pipes the data to stdout:

```
socat TCP-LISTEN:6142 stdout
```

When we run our app with `cargo run`, then `socat` outputs `hello world`.

# Next steps

Now that we have successfully built a tiny client to get a feel for how
Tokio works, we'll dive into more detail about how everything works.

[`net`]: https://docs.rs/tokio/0.2/tokio/net/index.html
[`async function`]: https://doc.rust-lang.org/reference/items/functions.html#async-functions
