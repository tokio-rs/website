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

# When to use tasks

TODO: Intro:

## Processing inbound sockets

## Background processing

## Coordinating access to a resource


[Go's goroutine]: https://www.golang-book.com/books/intro/10
[Erlang's process]: http://erlang.org/doc/reference_manual/processes.html
[`futures`]: {{< api-url "futures" >}}
[`sync`]: {{< api-url "futures" >}}/sync/index.html
[`oneshot`]: {{< api-url "futures" >}}/sync/oneshot/index.html
[`mpsc`]: {{< api-url "futures" >}}/sync/mpsc/index.html

