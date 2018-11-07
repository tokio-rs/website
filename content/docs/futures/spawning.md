---
title: "Spawning"
weight : 2060
menu:
  docs:
    parent: futures
---

Tokio based applications are organized in terms of Tasks. A task is a small unit
of logic that executes independently from other tasks. It is similar to [Go's
goroutine] and [Erlang's process], but asynchronous. In other words, tasks are
asynchronous green threads. Tasks are spawned for similar reasons that threads
are spawned in syhnchronous code, but spawning a task with Tokio is extremely
lightweight.

Previous examples defined a future and passed that future to `tokio::run`. This
resulted in a task being spawned onto Tokio's runtime to execute the provided
future. Additional tasks may be spanwed by calling `tokio::spawn`, but only from
code that is already running on a Tokio task. One way to think about it is the
future passed to `tokio::run` is the "main function".

In the following example, four tasks are spawned.

```rust
extern crate tokio;
extern crate futures;

use futures::future::lazy;

tokio::run(lazy(|| {
    for i in 0..4 {
        tokio::spawn(lazy(move || {
            println!("Hello from task {}", i);
            Ok(())
        }));
    }

    Ok(())
}));
```

The `tokio::run` function will block until the the future passed to `run`
teriminates as well as **all other spawned tasks**. In this case, `tokio::run`
blocks until all four tasks output to STDOUT and terminate.

The [`lazy`] function runs the closure the first time the future is polled. It
is used here to ensure that `tokio::spawn` is called from a task. Without
[`lazy`], `tokio::spawn` would be called from outside the context of a task,
which results in an error.

# Communicating with tasks

Just as with Go and Erlang, tasks can communicate using message passing. In
fact, it will be very common to use message passing to coordinate multiple
tasks. This allows independent tasks to still interact.

The [`futures`] crate provides a [`sync`] module which contains some channel
types that are ideal for message passing across tasks.

* [`oneshot`] is a channel for sending exactly one value.
* [`mpsc`] is a channel for sending many (zero or more) values.

A `oneshot` is ideal for getting the result from a spawned task:

```rust
extern crate tokio;
extern crate futures;

use futures::Future;
use futures::future::lazy;
use futures::sync::oneshot;

tokio::run(lazy(|| {
    let (tx, rx) = oneshot::channel();

    tokio::spawn(lazy(|| {
        tx.send("hello from spawned task");
        Ok(())
    }));

    rx.and_then(|msg| {
        println!("Got `{}`", msg);
        Ok(())
    })
    .map_err(|e| println!("error = {:?}", e))
}));
```

And `mpsc` is good for sending a stream of values to another task:

```rust
extern crate tokio;
extern crate futures;

use futures::{stream, Future, Stream, Sink};
use futures::future::lazy;
use futures::sync::mpsc;

tokio::run(lazy(|| {
    let (tx, rx) = mpsc::channel(1_024);

    tokio::spawn({
        stream::iter_ok(0..10).fold(tx, |tx, i| {
            tx.send(format!("Message {} from spawned task", i))
                .map_err(|e| println!("error = {:?}", e))
        })
        .map(|_| ()) // Drop tx handle
    });

    rx.for_each(|msg| {
        println!("Got `{}`", msg);
        Ok(())
    })
}));
```

These two message passing primitives will also be used in the examples below to
coordinate and communicate between tasks.

# Multi threaded

While it is possible to introduce concurrency with futures without spawning
tasks, this concurrency will be limited to running on a single thread. Spawning
tasks allows the Tokio runtime to schedule these tasks on multiple threads.

The [multi-threaded Tokio runtime][rt] manages multiple OS threads internally.
It multiplexes many tasks across a few physical threads. When a Tokio
application spawns its tasks, these tasks are submitted to the runtime and the
runtime handles scheduling.

[rt]: https://docs.rs/tokio/0.1/tokio/runtime/index.html

# When to spawn tasks

As all things software related, the answer is that it depends. Generally, the
answer is spawn a new task whenever you can. The more available tasks, the
greater the ability to run the tasks in parallel. However, keep in mind that if
multiple tasks do require communication, this will involve channel overhead.

The following examples will help illustrate cases for spawning new tasks.

## Processing inbound sockets

Spawn a task per socket.

## Background processing

Example: send messages to a background task to do metrics rollups and publish on an
interval.

## Coordinating access to a resource

Example: Read / write from a socket. Send pings, return pong RTT.

# When not to spawn tasks

If the amount of coordination via message passing and synchronization primitives
outweighs the parallism benefits from spawning tasks, then maintaining a single
task is preferred.

For example, it is generally better to maintain reading from and writing to a
single TCP socket on a single task instead of splitting up reading and writing
between two tasks.

[Go's goroutine]: https://www.golang-book.com/books/intro/10
[Erlang's process]: http://erlang.org/doc/reference_manual/processes.html
[`futures`]: {{< api-url "futures" >}}
[`sync`]: {{< api-url "futures" >}}/sync/index.html
[`oneshot`]: {{< api-url "futures" >}}/sync/oneshot/index.html
[`mpsc`]: {{< api-url "futures" >}}/sync/mpsc/index.html
[`lazy`]: https://docs.rs/futures/0.1/futures/future/fn.lazy.html
