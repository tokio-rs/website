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

Before we begin you should have a very basic understanding of how TCP streams work. Having
an understanding of Rust’s [standard library implementation](https://doc.rust-lang.org/std/net/struct.TcpStream.html)
is also helpful.

Let's get started.

First, generate a new crate.

```bash
$ cargo new hello-world
$ cd hello-world
```

Next, add the necessary dependencies in `Cargo.toml`:

```toml
[dependencies]
tokio = "0.2.0-alpha"
```

We are going to use Tokio's own [`net`] module. This module provides the same
abstractions over networking and I/O-operations as the corresponding module in `std`
with a small difference: all actions are performed asynchronously.

# Creating the stream

The first step is to create the `TcpStream`. We use the `TcpStream` implementation
provided by Tokio.

```rust
use tokio::net::TcpStream;

fn main() {
    let addr = "127.0.0.1:6142";
    let client = TcpStream::connect(addr);

    // Following snippets come here...
}
```

Next, we'll add some to the `client` `TcpStream`. This asynchronous task now creates
the stream and then yields it once it's been created for additional processing.

```rust
# use tokio::net::TcpStream;

# fn main() {
let addr = "127.0.0.1:6142";
let client = TcpStream::connect(addr);

let future = async move {
  // TcpStream::connect future has an Output type of io::Result<TcpStream>
  match client.await {
    Ok(_stream) => {
      println!("created stream");

      // Process stream here.
    }
    Err(err) => {
      // In our example, we are only going to log the error to STDOUT.
      println!("connection error = {:?}", err);
    }
  };
};
# }
```

The call to `TcpStream::connect` returns a [`Future`] of the created TCP stream.
We'll learn more about [`Futures`] later in the guide, but for now you can think of
a [`Future`] as a value that represents something that will eventually happen in the
future (in this case the stream will be created). This means that `TcpStream::connect` does
not wait for the stream to be created before it returns. Rather, it returns immediately
with a value representing the work of creating a TCP stream.

Note the `async` block that follows. Like the `TcpStream::connect` future,
the contents of the `async` block are not executed immediately.
Instead, they are stored in an object whose result can be computed later.
Inside the `async` block we can `await` the created future, so that any code that follows
is executed with the result of the `await`-ed [`Future`]'s computation.

We will be digging more into futures (and the related concepts of streams and sinks) later on.

Next, we will process the stream.

# Writing data

Our goal is to write `"hello world\n"` to the stream.

Going back to the `async` block in the previous example:

```rust
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

fn main() {
    let addr = "127.0.0.1:6142";
    let client = TcpStream::connect(addr);

    let future = async move {
        if let Ok(mut stream) = client.await {
            println!("created stream");

            let result = stream.write_all(b"hello world\n").await;

            println!("wrote to stream; success={:?}", result.is_ok());
        }
    };
}
```

The [`AsyncWriteExt::write_all`] trait method takes `stream` by mutable reference,
[`Future`] that completes once the entire message has been written to the
stream. In our example, we `await` for the completion of said future and just
write a message to `STDOUT` indicating that the write has completed.

Note that `result` is a `Result` that contains the original stream (compare to
`and_then`, which passes the stream without the `Result` wrapper). This allows us
to sequence additional reads or writes to the same stream. However, we have
nothing more to do, so we just drop the stream, which automatically closes it.

# Running the client task

So far we have a `Future` representing the work to be done by our program, but we
have not actually run it. We need a way to 'spawn' that work. We need an executor.

Executors are responsible for scheduling asynchronous tasks, driving them to
completion. There are a number of executor implementations to choose from, each have
different pros and cons. In this example, we will use the default executor of the
[Tokio runtime][rt].

```rust
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

#[tokio::main]
async fn main() {
    let addr = "127.0.0.1:6142";
    let client = TcpStream::connect(addr);

    if let Ok(mut stream) = client.await {
        println!("created stream");

        let result = stream.write_all(b"hello world\n").await;

        println!("wrote to stream; success={:?}", result.is_ok());
    }
}
```

Notice how `main()` has become an `async` function. It is equivalent to placing all its code inside an `async` block.

If we rewrite this example in full, without the procedural macro:

```rust
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::runtime::Runtime;

fn main() {
    let addr = "127.0.0.1:6142";
    let client = TcpStream::connect(addr);

    let future = async move {
        if let Ok(mut stream) = client.await {
            println!("created stream");

            let result = stream.write_all(b"hello world\n").await;

            println!("wrote to stream; success={:?}", result.is_ok());
        }
    };

    let rt = Runtime::new().unwrap();
    println!("About to create the stream and write to it...");
    rt.block_on(future);
    println!("Stream has been created and written to.");
}
```

In this case we create the default runtime, and spawn the task onto it, blocking the current thread until all spawned tasks
have completed and all resources (like files and sockets) have been dropped.

So far, we only have a single task running on the executor, so the `client` task
is the only one blocking `run` from returning. Once `run` has returned we can be sure
that our Future has been run to completion.

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

[`Future`]: {{< api-url "futures" >}}/future/trait.Future.html
[`Futures`]: /docs/getting-started/futures/
[rt]: {{< api-url "tokio" >}}/runtime/index.html
[`net`]: {{< api-url "tokio" >}}/net/index.html
[`io::write_all`]: {{< api-url "tokio" >}}/io/fn.write_all.html
[full-code]: https://github.com/tokio-rs/tokio/tree/v0.1.x/tokio/examples/hello_world.rs
[Netcat]: http://netcat.sourceforge.net/
[Nmap.org]: https://nmap.org
