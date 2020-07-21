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

# fn dox() {
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
# }

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
| Concurrency does not require parallelism. Because Tokio is asynchronous, many
| requests can be processed concurrently on a single thread.

To process connections concurrently, a new task is spawned for each inbound
connection. The connection is processed on this task.

The accept loop becomes:

```rust
use tokio::net::TcpListener;

# fn dox() {
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
# }
# async fn process(_: tokio::net::TcpStream) {}
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

## `'static` bound

Tasks spawned by `tokio::spawn` **must** be `'static`. The expression being
spawned must not borrow any data.

For example, the following will not compile:

```rust,compile_fail
use tokio::task;

#[tokio::main]
async fn main() {
    let v = vec![1, 2, 3];

    task::spawn(async {
        println!("Here's a vec: {:?}", v);
    });
}
```

Attempting to compile this results in the following error:

```text
error[E0373]: async block may outlive the current function, but
              it borrows `v`, which is owned by the current function
 --> src/main.rs:7:23
  |
7 |       task::spawn(async {
  |  _______________________^
8 | |         println!("Here's a vec: {:?}", v);
  | |                                        - `v` is borrowed here
9 | |     });
  | |_____^ may outlive borrowed value `v`
  |
note: function requires argument type to outlive `'static`
 --> src/main.rs:7:17
  |
7 |       task::spawn(async {
  |  _________________^
8 | |         println!("Here's a vector: {:?}", v);
9 | |     });
  | |_____^
help: to force the async block to take ownership of `v` (and any other
      referenced variables), use the `move` keyword
  |
7 |     task::spawn(async move {
8 |         println!("Here's a vec: {:?}", v);
9 |     });
  |
```

This happens because, by default, variables are not **moved** into async blocks.
The `v` vector remains owned by the `main` function. The `println!` line borrows
`v`. The rust compiler helpfully explains this to us and even suggests the fix!
Changing line 7 to `task::spawn(async move {` will instruct the compiler to
**move** `v` into the spawned task. Now, the task owns all of its data, making
it `'static`.

If a single piece of data must be accessible from more than one task
concurrently, then it must be shared by a tool such as `Arc`.

## `Send` bound

Tasks spawned by `tokio::spawn` **must** implement `Send`. This allows the Tokio
runtime to move the tasks between threads while they are suspended at an
`.await`.

Tasks are `Send` when **all** data that is held **across** `.await` calls is
`Send`. This is a bit subtle. When `.await` is called, the task yields back to
the scheduler. The next time the task is executed, it resumes from the point it
last yielded. To make this work, all state that is used **after** `.await` must
be saved by the task. If this state is `Send`, i.e. can be moved across threads,
then the task itself can be moved across threads. Similarly, if the state is not
`Send`, then neither is the task.

For example, this works:

```rust
use tokio::task::yield_now;
use std::rc::Rc;

#[tokio::main]
async fn main() {
    tokio::spawn(async {
        // The scope forces `rc` to drop before `.await`.
        {
            let rc = Rc::new("hello");
            println!("{}", rc);
        }

        // `rc` is no longer used. It is **not** persisted when
        // the task yields to the scheduler
        yield_now().await;
    });
}
```

This does not:

```rust,compile_fail
use tokio::task::yield_now;
use std::rc::Rc;

#[tokio::main]
async fn main() {
    tokio::spawn(async {
        let rc = Rc::new("hello");

        // `rc` is used after `.await`. It must be persisted to
        // the task's state.
        yield_now().await;

        println!("{}", rc);
    });
}
```

Attempting to compile the snippet results in:

```text
error: future cannot be sent between threads safely
   --> src/main.rs:6:5
    |
6   |     tokio::spawn(async {
    |     ^^^^^^^^^^^^ future created by async block is not `Send`
    | 
   ::: [..]spawn.rs:127:21
    |
127 |         T: Future + Send + 'static,
    |                     ---- required by this bound in
    |                          `tokio::task::spawn::spawn`
    |
    = help: within `impl std::future::Future`, the trait
    |       `std::marker::Send` is not  implemented for
    |       `std::rc::Rc<&str>`
note: future is not `Send` as this value is used across an await
   --> src/main.rs:10:9
    |
7   |         let rc = Rc::new("hello");
    |             -- has type `std::rc::Rc<&str>` which is not `Send`
...
10  |         yield_now().await;
    |         ^^^^^^^^^^^^^^^^^ await occurs here, with `rc` maybe
    |                           used later
11  |         println!("{}", rc);
12  |     });
    |     - `rc` is later dropped here
```

# Store values

We will now implement the `process` function to handle incoming commands. We
will use a `HashMap` to store values. `SET` commands will insert into the
`HashMap` and `GET` values will load them. Additionally, we will use a loop to
accept more than one command per connection.

```rust
use tokio::net::TcpStream;
use mini_redis::{Connection, Frame};

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

and in a separate terminal window, run the `hello-redis` example:

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

You can find the full code [here][full].

In the next section, we will implement persisting data for all sockets.

[full]: https://github.com/tokio-rs/website/blob/master/tutorial-code/spawning/src/main.rs
