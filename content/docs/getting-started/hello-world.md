---
title: "Hello world!"
weight : 1010
menu:
  docs:
    parent: getting_started
---

This guide assumes that a knowledge of the [Rust programming language] and are
using Rust `1.39.0` or higher. To use Tokio with earlier versions of Rust,
please check out the [Tokio 0.1 docs].

To check version of Rust on the command line:
```bash
rustc --version
rustc 1.39.0 (4560ea788 2019-11-04)
```

In version `1.39.0`, [Rust introduced async-await], see the [Async Book] for
in-depth documentation of these new Rust language features. This guide also
seeks to provide a practical, hands-on introduction for all of the Rust language
features that are needed for programming with Tokio.

Also, most readers will have some experience with writing networking code
using the [Rust standard library] or another language, though folks who are
new to network programming should be able to follow along.

# Introducing asynchronous programming

As our first introduction to [asynchronous programming](../../overview) with
Tokio, we will start with a tiny app that sends "hello, world!" over a
network connection.

The difference between Tokio and a Rust program written using the standard
library is that Tokio has the flexibility to avoid blocking program execution
when the stream is created or when our “hello, world!” message is written
to the stream.

Tokio's [`net`] module provides the same abstraction over networking as
the corresponding modules in `std` except asynchronously.

# Communicating through a network connection

When developing network code, it's helpful to use tools that let us simulate
each end of the connection. We've chosen two to allow us to receive text
(*listen* on a socket and *read* data) and send text (*write* data).

We'll start by sending "hello" over a reliable networking connection ([`TCP`]).
Before writing code in Rust, let's install and use some network tools to
manually do what our code will do later in the guide.

Install [`socat`](../../network-utilities/socat), which is a network utility that
we'll use to simulate a server. Then type the following command to print
out everything that is received on port 6142 (a somewhat arbitrary number
we have chosen for this example):

```bash
socat TCP-LISTEN:6142,fork stdout
```

An easy way to simulate a client (for a text-based protocol) is to use
[`telnet`]. To connect to our simulated server, we'll open a different
window so we can see two terminals side-by-side and type the following on the
command-line:

```bash
telnet localhost 6142
```

Telnet will output something like this:
```bash
Trying 127.0.0.1...
Connected to localhost.
Escape character is '^]'.
```

Now if we type `hello` and press return, we should see `hello` printed by
socat.

To *escape* from our TCP session (`^]`), we need to hold down `Ctrl` key and
type `]`). Then at the telnet prompt (`telnet >`), typing `quit` will close
the connection and exit the program.

Let's quit telnet and write some Rust code to send some text to our server.
We'll leave socat running, so we can connect to it with our new app!

# Let's write some code!

Next we'll write some code to create a TCP stream and write “hello, world!”
to the stream using Tokio.

Let's get started by generating a new Rust app:

```bash
$ cargo new hello-world
$ cd hello-world
```

For a quick start, we'll add the Tokio crate with all Tokio of its features
to our Cargo manifest, by adding the following text to `Cargo.toml`.

```toml
[dependencies]
tokio = { version = "0.2", features = ["full"] }
```

Then we'll replace `main.rs` with our "hello world" code:

```rust,no_run
# #![deny(deprecated)]

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

The `#[tokio::main]` macro provides common boilerplate for setting up the
tokio runtime, so that we can write `main()` as an [`async function`]. This
enables us to call asynchronous functions and write sequential code as if
they were blocking by using the Rust `await` keyword.

Now when we run our app with `cargo run` (in a different window from where
we are running socat), we should see socat print `hello world`.

# Next steps

Now that we have successfully built a tiny client to get a feel for network
programming with Tokio, we'll dive into more detail about how everything works.

[Rust programming language]: https://www.rust-lang.org/
[Tokio 0.1 docs]: https://v0-1--tokio.netlify.com/docs/getting-started/hello-world/
[Rust introduced async-await]: https://blog.rust-lang.org/2019/11/07/Async-await-stable.html
[Async Book]: https://rust-lang.github.io/async-book/index.html
[Rust standard library]: https://doc.rust-lang.org/std/net/index.html
[`TCP`]: (https://tools.ietf.org/html/rfc793
[`net`]: https://docs.rs/tokio/*/tokio/net/index.html
[`async function`]: https://doc.rust-lang.org/reference/items/functions.html#async-functions
