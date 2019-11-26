---
title: "Hello World!"
weight : 1010
menu:
  docs:
    parent: getting_started
---

To kick off our tour of Tokio, we will start with the obligatory "hello world"
example. This program will create a TCP stream and write "hello, world!" to the stream.
The difference between this and a Rust program that writes to a TCP stream without Tokio
is that this program won't block program execution when the stream is created or when
our "hello, world!" message is written to the stream.

Before we begin you should have a very basic understanding of how TCP streams
work. Having an understanding of Rust’s [standard library
implementation](https://doc.rust-lang.org/std/net/struct.TcpStream.html) is also
helpful.

Let's get started.

First, generate a new crate.

```bash
$ cargo new hello-world
$ cd hello-world
```

Next, add the necessary dependencies in `Cargo.toml`:

```toml
[dependencies]
tokio = { version = "0.2", features = ["full"] }
```

Tokio requires specifying the requested components using feature flags. This
allows the user to only include what is needed to run the application, resulting
in smaller binaries. For getting started, we depend on `full`, which includes
all components.

Next, add the following to `main.rs`:

```rust
# #![deny(deprecated)]

use tokio::io;
use tokio::net::TcpStream;
use tokio::prelude::*;

#[tokio::main]
async fn main() {
    // application comes here
}
```

Here we use Tokio's own [`io`] and [`net`] modules. These modules provide the same
abstractions over networking and I/O-operations as the corresponding modules in
`std` with a difference: all actions are performed asynchronously.

Next is the Tokio application entry point. This is an `async` main function
annotated with `#[tokio::main]`. This is the function that first runs when the
binary is executed. The `#[tokio::main]` annotation informs Tokio that this is
where the runtime (all the infrastructure needed to power Tokio) is started.

# Creating the TCP stream

The first step is to create the `TcpStream`. We use the `TcpStream` implementation
provided by Tokio.

```rust,no_run
# #![deny(deprecated)]
#
# use tokio::net::TcpStream;
#[tokio::main]
async fn main() {
    // Connect to port 6142 on localhost
    let stream = TcpStream::connect("127.0.0.1:6142").await.unwrap();

    // Following snippets come here...
}
```

`TcpStream::connect` is an _asynchronous_ function. No work is done during the
function call. Instead, `.await` is called to pause the current task until the
connect has completed. Once the connect has completed, the task resumes. The
`.await` call does **not** block the current thread.

Next, we do work with the TCP stream.

# Writing data

Our goal is to write `"hello world\n"` to the stream.

```rust,no_run
# #![deny(deprecated)]
#
# use tokio::net::TcpStream;
# use tokio::prelude::*;
# #[tokio::main]
# async fn main() {
// Connect to port 6142 on localhost
let mut stream = TcpStream::connect("127.0.0.1:6142").await.unwrap();

stream.write_all(b"hello world\n").await.unwrap();

println!("wrote to stream");
# }
```

The [`write_all`] function is implemented for all "stream" like types. It is
provided by the [`AsyncWriteExt`] trait. Again, the function is asynchronous, so
no work is done unless `.await` is called. We call `.await` to perform the
write.

You can find the full example [here][full-code].

# Running the code

[Netcat] is a tool for quickly creating TCP sockets from the command line. The following
command starts a listening TCP socket on the previously specified port.

```bash
$ nc -l -p 6142
```
> The command above is used with the GNU version of netcat that comes stock on many
> unix based operating systems. The following command can be used with the
> [NMap.org][NMap.org] version: `$ ncat -l -p 6142`

In a different terminal we'll run our project.

```bash
$ cargo run
```

If everything goes well, you should see `hello world` printed from Netcat.

# Next steps

We've only dipped our toes into Tokio and its asynchronous model. The next page in
the guide will start digging a bit deeper into Futures and the Tokio runtime model.

[`io`]: https://docs.rs/tokio/0.2/tokio/io/index.html
[`net`]: https://docs.rs/tokio/0.2/tokio/net/index.html
[`write_all`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncWriteExt.html#method.write_all
[`AsyncWriteExt`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncWriteExt.html
[full-code]: https://github.com/tokio-rs/tokio/blob/master/examples/hello_world.rs
[Netcat]: http://netcat.sourceforge.net/
[Nmap.org]: https://nmap.org
