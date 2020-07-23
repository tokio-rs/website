---
title: "Shared state"
---

So far, we have a key-value server working. However, there is a major flaw:
State is not shared across connections. We will fix that in this article.

# Strategies

There are a couple of different ways to share state in Tokio.

1. Guard the shared state with a Mutex.
2. Spawn a task to manage the state and use message passing to operate on it.

Spawning a task to manage state is usually the preferred strategy when
operations on the data require asynchronous work. This strategy will be used in
a later section. Right now, the shared state is a `HashMap` and the operations
are `insert` and `get`. Both of these operations are near-instant, so we
will use a `Mutex`.

# Add `bytes` dependency

Instead of using `Vec<u8>`, the Mini-Redis crate uses `Bytes` from the [`bytes`]
crate. The goal of `Bytes` is to provide a robust byte array structure for
network programming. The biggest feature it adds over `Vec<u8>` is shallow
cloning. In other words, calling `clone()` on a `Bytes` instance does not copy
the underlying data. Instead, a `Bytes` instance is a reference-counted handle
to some underlying data. The `Bytes` type is roughly an `Arc<Vec<u8>>` but with
some added capabilities.

To depend on `bytes`, add the following to your `Cargo.toml` in the
`[dependencies]` section:

```toml
bytes = "0.5"
```

[`bytes`]: https://docs.rs/bytes/0.5/bytes/struct.Bytes.html

# Initialize the `HashMap`

The `HashMap` will be shared across many tasks and potentially many threads. To
support this, it is wrapped in `Arc<Mutex<_>>`.

First, for convenience, add the following after the `use` statements.

```rust
use bytes::Bytes;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

type Db = Arc<Mutex<HashMap<String, Bytes>>>;
```

Then, update the `main` function to initialize the `HashMap` and pass an `Arc`
**handle** to the `process` function. Using `Arc` allows the `HashMap` to be
referenced concurrently from many tasks, potentially running on many threads.
Throughout Tokio, the term **handle** is used to reference a value that provides
access to some shared state.

```rust
use tokio::net::TcpListener;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

# fn dox() {
#[tokio::main]
async fn main() {
    let mut listener = TcpListener::bind("127.0.0.1:6379").await.unwrap();

    println!("Listening");

    let db = Arc::new(Mutex::new(HashMap::new()));

    loop {
        let (socket, _) = listener.accept().await.unwrap();
        // Clone the handle
        let db = db.clone();

        println!("Accepted");
        process(socket, db).await;
    }
}
# }
# type Db = Arc<Mutex<HashMap<(), ()>>>;
# async fn process(_: tokio::net::TcpStream, _: Db) {}
```

## On using `std::sync::Mutex`

Note, `std::sync::Mutex` and **not** `tokio::sync::Mutex` is used to guard the
`HashMap`. A common error is to unconditionally use `tokio::sync::Mutex` from
within async code. An async mutex is a mutex that is locked across calls to
`.await`.

A synchronous mutex will block the current thread when waiting to acquire the
lock. This, in turn, will block other tasks from processing. However, switching
to `tokio::sync::Mutex` usually does not help as the asynchronous mutex uses a
synchronous mutex internally.

As a rule of thumb, using a synchronous mutex from within asynchronous code is
fine as long as contention remains low and the lock is not held across calls to
`.await`. Additionally, consider using [`parking_lot::Mutex`][parking_lot] as a
faster alternative to `std::sync::Mutex`.

[parking_lot]: https://docs.rs/parking_lot/0.10.2/parking_lot/type.Mutex.html

# Update `process()`

The process function no longer initializes a `HashMap`. Instead, it takes the
shared handle to the `HashMap` as an argument. It also needs to lock the
`HashMap` before using it.

```rust
use tokio::net::TcpStream;
use mini_redis::{Connection, Frame};
# use std::collections::HashMap;
# use std::sync::{Arc, Mutex};
# type Db = Arc<Mutex<HashMap<String, bytes::Bytes>>>;

async fn process(socket: TcpStream, db: Db) {
    use mini_redis::Command::{self, Get, Set};

    // Connection, provided by `mini-redis`, handles parsing frames from
    // the socket
    let mut connection = Connection::new(socket);

    while let Some(frame) = connection.read_frame().await.unwrap() {
        let response = match Command::from_frame(frame).unwrap() {
            Set(cmd) => {
                let mut db = db.lock().unwrap();
                db.insert(cmd.key().to_string(), cmd.value().clone());
                Frame::Simple("OK".to_string())
            }           
            Get(cmd) => {
                let db = db.lock().unwrap();
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

# Tasks, threads, and contention

Using a blocking mutex to guard short critical sections is an acceptable
strategy when contention is minimal. When a lock is contended, the thread
executing the task must block and wait on the mutex. This will not only block
the current task but it will also block all other tasks scheduled on the current
thread.

By default, the Tokio runtime uses a multi-threaded scheduler. Tasks are
scheduled on any number of threads managed by the runtime. If a large number of
tasks are scheduled to execute and they all require access to the mutex, then
there will be contention. On the other hand, if the [`basic_scheduler`][basic]
is used, then the mutex will never be contended.

[[info]]
| The [`basic_scheduler` runtime option][basic-rt] is a lightweight,
| single-threaded runtime. It is a good choice when only spawning
| a few tasks and opening a handful of sockets. For example, this
| option works well when providing a synchronous API bridge on top
| of an asynchronous client library.

[basic-rt]: https://docs.rs/tokio/0.2/tokio/runtime/struct.Builder.html#method.basic_scheduler

If a contention on a synchronous mutex becomes a problem, the best fix is rarely
to switch to the Tokio mutex. Instead, options to consider are:

- Switching to a dedicated task to manage state and use message passing.
- Shard the mutex
- Restructure the code to avoid the mutex.

In our case, as each *key* is independent, mutex sharding will work well. To do
this, instead of having a single `Mutex<HashMap<_, _>>` instance, we would
introduce `N` distinct instances.

```rust
# use std::collections::HashMap;
# use std::sync::{Arc, Mutex};
type ShardedDb = Arc<Vec<Mutex<HashMap<String, Vec<u8>>>>>;
```

Then, finding the cell for any given key becomes a two step process. First, the
key is used to identify which shard it is part of. Then, the key is looked up in
the `HashMap`.

```rust,compile_fail
let shard = db[hash(key) % db.len()].lock().unwrap();
shard.insert(key, value);
```

[basic]: https://docs.rs/tokio/0.2/tokio/runtime/index.html#basic-scheduler

# Holding a `MutexGuard` across an `.await`

If you are using `std::sync::Mutex` and use an `.await` while the mutex is
locked, you will typically see an error like this:

```text
error: future cannot be sent between threads safely
[...]
    |     tokio::spawn(async move {
    |     ^^^^^^^^^^^^ future created by async block is not `Send`
```

This happens because the `std::sync::MutexGuard` type is **not** `Send`. This
means that you can't send a mutex lock to another thread, and the error happens
because the Tokio runtime can move a task between threads at every `.await`.
To avoid this, you should restructure your code such that the mutex lock is not
in scope when the `.await` is performed.

You should not try to circumvent this issue by spawning the task in a way that
does not require it to be `Send`, because if Tokio suspends your task at an
`.await` while the task is holding the lock, some other task may be scheduled to
run on the same thread, and this other task may also try to lock that mutex,
which would result in a deadlock as the task waiting to lock the mutex would
prevent the task holding the mutex from running.

There are generally three approaches to solving this issue:

1. Restructure your code to not hold the lock across the `.await`.
2. Spawn a task to manage the resource and use message passing to talk to it.
3. Use Tokio's asynchronous mutex.


[`MutexGuard`]: https://doc.rust-lang.org/stable/std/sync/struct.MutexGuard.html
