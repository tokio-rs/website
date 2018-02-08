+++
title = "Hello World!"
description = ""
menu = "getting_started"
weight = 110
+++

To kick off our tour of Tokio, we will start with the obligatory "hello world"
example. This server will listen for incoming connections. Once a connection is
received, it will write "hello world" to the client and close the connection.

Let's get started.

First, generate a new crate.

```shell
$ cargo new --bin hello-world
cd hello-world
```

Next, add the necessary dependencies:

```toml
[dependencies]
tokio = "0.1"
tokio-io = "0.1"
futures = "0.1"
```

and the crates and types into scope in `main.rs`:

```rust
# #![deny(deprecated)]
extern crate tokio;
extern crate tokio_io;
extern crate futures;

use tokio::executor::current_thread;
use tokio::net::TcpListener;
use tokio_io::io;
use futures::{Future, Stream};
# fn main() {}
```

## [Writing the server](#writing) {#writing}

The first step is to bind a `TcpListener` to a local port. We use the
`TcpListener` implementation provided by Tokio.

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate tokio_io;
# extern crate futures;
#
# use tokio::executor::current_thread;
# use tokio::net::TcpListener;
# use tokio_io::io;
# use futures::{Future, Stream};
fn main() {
    let addr = "127.0.0.1:6142".parse().unwrap();
    let listener = TcpListener::bind(&addr).unwrap();

    // Following snippets come here...
}
```

Next, we define the server task. This asynchronous task will listen for incoming
connections on the bound listener and process each accepted connection.

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate tokio_io;
# extern crate futures;
#
# use tokio::executor::current_thread;
# use tokio::net::TcpListener;
# use tokio_io::io;
# use futures::{Future, Stream};
# fn main() {
#     let addr = "127.0.0.1:6142".parse().unwrap();
#     let listener = TcpListener::bind(&addr).unwrap();
let server = listener.incoming().for_each(|socket| {
    println!("accepted socket; addr={:?}", socket.peer_addr().unwrap());

    // Process socket here.

    Ok(())
})
.map_err(|err| {
    // All tasks must have an `Error` type of `()`. This forces error
    // handling and helps avoid silencing failures.
    //
    // In our example, we are only going to log the error to STDOUT.
    println!("accept error = {:?}", err);
});
# }
```

Combinator functions are used to define asynchronous tasks. The call to
`listener.incoming()` returns a [`Stream`] of accepted connections. A [`Stream`]
is kind of like an asynchronous iterator.

Each combinator function takes ownership of necessary state as well as the
callback to perform and returns a new `Future` or `Stream` that has the
additional "step" sequenced.

Returned futures and streams are lazy, i.e., no work is performed when calling
the combinator. Instead, once all the asynchronous steps are sequenced, the
final `Future` (representing the task) is spawned on an executor. This is when
the work that was previously defined starts getting run.

We will be digging into futures and streams later on.

## [Spawning the task](#spawning) {#spawning}

Executors are responsible for scheduling asynchronous tasks, driving them to
completion. There are a number of executor implementations to choose from, each have
different pros and cons. In this example, we will use the [`current_thread`]
executor.

The [`current_thread`] executor multiplexes all spawned tasks on the current
thread.

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate tokio_io;
# extern crate futures;
#
# use tokio::executor::current_thread;
# use tokio::net::TcpListener;
# use tokio_io::io;
# use futures::{Future, Stream};
# fn main() {
#     let addr = "127.0.0.1:6142".parse().unwrap();
#     let listener = TcpListener::bind(&addr).unwrap();
# let server = listener.incoming().for_each(|socket| {
#     Ok(())
# })
# .map_err(|_| ());
# /*
current_thread::run(|_| {
# */ current_thread::run(|ctx| {
    // Now, the server task is spawned.
    current_thread::spawn(server);
# ctx.cancel_all_spawned();

    println!("server running on localhost:6142");
});
# }
```

`current_thread::run` starts the executor, blocking the current thread until
all spawned tasks have completed. Spawning a task using [`current_thread`]
**must** happen from within the context of a running [`current_thread`]
executor.

`current_thread::run` takes a closure that allows initializing the executor with
tasks. In our case, this is the `server` task. When the closure returns (right
after the `println!` statement), the thread will be blocked until all tasks are
complete.

So far, we only have a single task running on the executor, so the `server` task
is the only one blocking `run` from returning.

Next, we will process the inbound sockets.

## [Writing Data](#writing-data) {#writing-data}

Our goal is to write `"hello world\n"` on each accepted socket. We will do this
by defining a new asynchronous task to do the write and spawning that task on
the same `current_thread` executor.

Going back to the `incoming().for_each` block.

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate tokio_io;
# extern crate futures;
#
# use tokio::executor::current_thread;
# use tokio::net::TcpListener;
# use tokio_io::io;
# use futures::{Future, Stream};
# fn main() {
#     let addr = "127.0.0.1:6142".parse().unwrap();
#     let listener = TcpListener::bind(&addr).unwrap();
let server = listener.incoming().for_each(|socket| {
    println!("accepted socket; addr={:?}", socket.peer_addr().unwrap());

    let connection = io::write_all(socket, "hello world\n")
        .then(|res| {
            println!("wrote message; success={:?}", res.is_ok());
            Ok(())
        });

    // Spawn a new task that processes the socket:
    current_thread::spawn(connection);

    Ok(())
})
# ;
# }
```

Again, we are defining an asynchrous task. This task will take ownership of the
socket, write the message on that socket, then complete. The `connection`
variable holds the final task. Again, no work has yet been performed.

`current_thread::spawn` is used to spawn the task on the executor. Because the
`server` future is running on a `current_thread` executor, we are able to spawn
further tasks on the same executor.

The [`io::write_all`] function takes ownership of `socket`, returning a
[`Future`] that completes once the entire message has been written to the
socket. `then` is used to sequence a step that gets run once the write has
completed. In our example, we just write a message to `STDOUT` indicating that
the write has completed.

Note that `res` is a `Result` that contains the original socket. This allows us
to sequence additional reads or writes on the same socket. However, we have
nothing more to do, so we just drop the socket, which closes it.

You can find the full example [here](#)

## [Next steps](#next-steps) {#next-steps}

We've only dipped our toes in Tokio and its asynchronous model. The next page in
the guide, will start digging deeper into the Tokio runtime model.

[`Future`]: {{< api-url "futures" >}}/trait.Future.html
[`Stream`]: {{< api-url "futures" >}}/trait.Stream.html
[`current_thread`]: {{< api-url "tokio" >}}/executor/current_thread/index.html
[`io::write_all`]: {{< api-url "tokio-io" >}}/io/fn.write_all.html
