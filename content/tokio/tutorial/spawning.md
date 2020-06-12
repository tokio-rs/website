---
title: "Spawning"
---

We are going to shift gears and start working on the Redis server.

First, move the client set / get code from the previous section to an example
file. This way, we can run it against our server.

```bash
mkdir -p examples
mv src/main.rs examples/hello-redis.rs
```

Then create a new, empty `src/main.rs` and continue.

# Accepting sockets

The first thing our Redis server needs to do is accept inbound TCP sockets. This
is done with [`tokio::net::TcpListener`][tcpl].

[[info]]
| Many of Tokio's types are named the same as their synchronous equivalent in
| the Rust standard library. When it makes sense, Tokio exposes the same APIs
| as `std` but using `async fn`.

A `TcpListener` is bound to port **6379**, then sockets are accepted in a loop.
Each socket is processed then closed. For now, we will read the command, print
it to stdout and respond with an error.

```rust
use tokio::net::{TcpListener, TcpStream};
use mini_redis::{Connection, Frame};

#[tokio::main]
async fn main() {
    // Bind the listener to the address
    let mut listener = TcpListener::bind("127.0.0.1:6379").await.unwrap();

    loop {
        // The second item contains the ip and port of the new connection.
        let (socket, _) = listener.accept().await.unwrap();
        process(socket).await;
    }
}

async fn process(socket: TcpStream) {
    // The `Connection` lets us read/write redis **frames** instead of
    // byte streams. The `Connection` type is defined by mini-redis.
    let mut connection = Connection::new(socket);

    if let Some(frame) = connection.read_frame().await.unwrap() {
        println!("GOT: {:?}", frame);

        // Respond with an error
        let response = Frame::Error("unimplemented".to_string());
        connection.write_frame(&response).await.unwrap();
    }
}
```

Now, run this accept loop:

```bash
$ cargo run
```

In a separate terminal window, run the `hello-redis` example (the SET/GET
command from the previous section):

```bash
$ cargo run --example hello-redis
```

The output should be:

```text
Error: "unimplemented"
```

In the server terminal, the output is:

```text
GOT: Array([Bulk(b"set"), Bulk(b"hello"), Bulk(b"world")])
```

[tcpl]: https://docs.rs/tokio/0.2/tokio/net/struct.TcpListener.html

# Concurrency

Our server has a slight problem (besides only responding with errors). It
processes inbound requests one at a time. When a connection is accepted, the
server stays inside the accept loop block until the response is fully written to
the socket.

We want our Redis server to process **many** concurrent requests. To do this, we
need to add some concurrency.

[[info]]
| Concurrency does not require parallism. Because Tokio is asynchronous, many
| requests can be processed concurrently on a single thread.

To process connections concurrently, a new task is spawned for each inbound
connection. The connection is processed on this task.

The accept loop becomes:

```rust
#[tokio::main]
async fn main() {
    let mut listener = TcpListener::bind("127.0.0.1:6379").await.unwrap();

    loop {
        let (socket, _) = listener.accept().await.unwrap();
        // A new task is spawned for each inbound socket. The socket is
        // moved to the new task and processed there.
        tokio::spawn(async move {
            process(socket).await;
        });
    }
}
```

## Tasks

A Tokio task is an asynchronous green thread. They are created by passing an
`async` block to `tokio::spawn`. The `tokio::spawn` function returns a
`JoinHandle`, which the caller may use to interact with the spawned task. The
`async` block may have a return value. The caller may obtain the return value
using `.await` on the `JoinHandle`.

For example:

```rust
#[tokio::main]
async fn main() {
    let handle = tokio::spawn(async {
        // Do some async work
        "return value"
    });

    // Do some other work

    let out = handle.await.unwrap();
    println!("GOT {}", out);
}
```

Awaiting on `JoinHandle` returns a `Result`. When a task encounters an error
during execution, the `JoinHandle` will return an `Err`. This happens when the
task either panics, or if the task is forcefully cancelled by the runtime
shutting down.

Tasks are the unit of execution managed by the scheduler. Spawning the task
submits it to the Tokio scheduler, which then ensures that the task executes
when it has work to do. The spawned task may be executed on the same thread
as where it was spawned, or it may execute on a different runtime thread. The
task can also be moved between threads after being spawned.

Tasks in Tokio are very lightweight. Under the hood, they require only a single
allocation and 64 bytes of memory. Applications should feel free to spawn
thousands, if not millions of tasks.

# Store values

We will now implement the `process` function to handle incoming commands. We
will use a `HashMap` to store values. `SET` commands will insert into the
`HashMap` and `GET` values will load them. Additionally, we will use a loop to
accept more than one command per connection.

```rust
async fn process(socket: TcpStream) {
    use mini_redis::Command::{self, Get, Set};
    use std::collections::HashMap;

    // A hashmap is used to store data
    let mut db = HashMap::new();

    // Connection, provided by `mini-redis`, handles parsing frames from
    // the socket
    let mut connection = Connection::new(socket);

    // Use `read_frame` to receive a command from the connection.
    while let Some(frame) = connection.read_frame().await.unwrap() {
        let response = match Command::from_frame(frame).unwrap() {
            Set(cmd) => {
                db.insert(cmd.key().to_string(), cmd.value().clone());
                Frame::Simple("OK".to_string())
            }
            Get(cmd) => {
                if let Some(value) = db.get(cmd.key()) {
                    Frame::Bulk(value.clone())
                } else {
                    Frame::Null
                }
            }
            cmd => panic!("unimplemented {:?}", cmd),
        };

        // Write the response to the client
        connection.write_frame(&response).await.unwrap();
    }
}
```

Now, start the server:

```bash
$ cargo run
```

and in a separate terminal window, run the `hello-tokio` example:

```bash
$ cargo run --example hello-redis
```

Now, the output will be:

```text
got value from the server; success=Some(b"world")
```

We can now get and set values, but there is a problem: The values are not
shared between connections. If another socket connects and tries to `GET`
the `hello` key, it will not find anything.

In the next section, we will implement persisting data for all sockets.
