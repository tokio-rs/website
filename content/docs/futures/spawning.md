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

The most straightforward example for spawning tasks is a network server.
The primary task listens for inbound sockets on a TCP listener. When a
new connection arrives, the listener task spawns a new task for
processing the socket.

```rust
extern crate tokio;
extern crate futures;

use tokio::io;
use tokio::net::TcpListener;
use futures::{Future, Stream};

let addr = "127.0.0.1:0".parse().unwrap();
let listener = TcpListener::bind(&addr).unwrap();

# if false {
tokio::run({
    listener.incoming().for_each(|socket| {
        // An inbound socket has been received.
        //
        // Spawn a new task to process the socket
        tokio::spawn({
            // In this example, "hello world" will be written to the
            // socket followed by the socket being closed.
            io::write_all(socket, "hello world")
                // Drop the socket
                .map(|_| ())
                // Write any error to STDOUT
                .map_err(|e| println!("socket error = {:?}", e))
        });

        // Receive the next inbound socket
        Ok(())
    })
    .map_err(|e| println!("listener error = {:?}", e))
});
# }
```

The listener task and the tasks that process each socket are completely
unrelated. They do not communicate and either can terminate without
impacting the others. This is a perfect use case for spawning tasks.

## Background processing

Another case is to spawn a task that runs background computations in
service of other tasks. The primary tasks send data to the background
task for processing but do not care about if and when the data gets
processed. This also allows a single background task to coalesce data
from multiple primary tasks.

This requires communication between the primary tasks and the background
task. This is usually handled with an [`mpsc`] channel.

The following example is a TCP server that reads data from the remote
peer and tracks the number of received bytes. It then sends the number
of received bytes to a background task. This background task writes the
total number of bytes read from all socket tasks every 30 seconds.

```rust
extern crate tokio;
extern crate futures;

use tokio::io;
use tokio::net::TcpListener;
use tokio::timer::Interval;
use futures::{future, stream, Future, Stream, Sink};
use futures::future::lazy;
use futures::sync::mpsc;
use std::time::Duration;

// Defines the background task. The `rx` argument is the channel receive
// handle. The task will pull `usize` values (which represent number of
// bytes read by a socket) off the channel and sum it internally. Every
// 30 seconds, the current sum is written to STDOUT and the sum is reset
// to zero.
fn bg_task(rx: mpsc::Receiver<usize>)
-> impl Future<Item = (), Error = ()>
{
    // The stream of received `usize` values will be merged with a 30
    // second interval stream. The value types of each stream must
    // match. This enum is used to track the various values.
    #[derive(Eq, PartialEq)]
    enum Item {
        Value(usize),
        Tick,
        Done,
    }

    // Interval at which the current sum is written to STDOUT.
    let tick_dur = Duration::from_secs(30);

    let interval = Interval::new_interval(tick_dur)
        .map(|_| Item::Tick)
        .map_err(|_| ());

    // Turn the stream into a sequence of:
    // Item(num), Item(num), ... Done
    //
    let items = rx.map(Item::Value)
      .chain(stream::once(Ok(Item::Done)))
      // Merge in the stream of intervals
      .select(interval)
      // Terminate the stream once `Done` is received. This is necessary
      // because `Interval` is an infinite stream and `select` will keep
      // selecting on it.
      .take_while(|item| future::ok(*item != Item::Done));

    // With the stream of `Item` values, start our logic.
    //
    // Using `fold` allows the state to be maintained across iterations.
    // In this case, the state is the number of read bytes between tick.
    items.fold(0, |num, item| {
        match item {
            // Sum the number of bytes with the state.
            Item::Value(v) => future::ok(num + v),
            Item::Tick => {
                println!("bytes read = {}", num);

                // Reset the byte counter
                future::ok(0)
            }
            _ => unreachable!(),
        }
    })
    .map(|_| ())
}

# if false {
// Start the application
tokio::run(lazy(|| {
    let addr = "127.0.0.1:0".parse().unwrap();
    let listener = TcpListener::bind(&addr).unwrap();

    // Create the channel that is used to communicate with the
    // background task.
    let (tx, rx) = mpsc::channel(1_024);

    // Spawn the background task:
    tokio::spawn(bg_task(rx));

    listener.incoming().for_each(move |socket| {
        // An inbound socket has been received.
        //
        // Spawn a new task to process the socket
        tokio::spawn({
            // Each spawned task will have a clone of the sender handle.
            let tx = tx.clone();

            // In this example, "hello world" will be written to the
            // socket followed by the socket being closed.
            io::read_to_end(socket, vec![])
                // Drop the socket
                .and_then(move |(_, buf)| {
                    tx.send(buf.len())
                        .map_err(|_| io::ErrorKind::Other.into())
                })
                .map(|_| ())
                // Write any error to STDOUT
                .map_err(|e| println!("socket error = {:?}", e))
        });

        // Receive the next inbound socket
        Ok(())
    })
    .map_err(|e| println!("listener error = {:?}", e))
}));
# }
```

## Coordinating access to a resource

When working with futures, the preferred strategy for coordinating
access to a shared resource (socket, data, etc...) is by using message
passing. To do this, a dedicated task is spawned to manage the resource
and other tasks interact with the resource by sending messages.

This pattern is very similar to the previous example, but this time the
tasks want to receive a message back once the operation is complete. To
implement this, both `mpsc` and `oneshot` channels are used.

The example coordinates access to a [transport] over a ping / pong
protocol. Pings are sent into the transport and pongs are received.
Primary tasks send a message to the coordinator task to initiate a ping,
the coordinator task will respond to the ping request with the [round
trip time][rtt]. The message sent to the coordinator task over the
`mpsc` contains a `oneshot::Sender` allowing the coordinator task to
respond.

```rust
extern crate tokio;
extern crate futures;

use tokio::io;
use futures::{future, Future, Stream, Sink};
use futures::future::lazy;
use futures::sync::{mpsc, oneshot};
use std::time::{Duration, Instant};

type Message = oneshot::Sender<Duration>;

struct Transport;

impl Transport {
    fn send_ping(&self) {
        // ...
    }

    fn recv_pong(&self) -> impl Future<Item = (), Error = io::Error> {
#         future::ok(())
        // ...
    }
}

fn coordinator_task(rx: mpsc::Receiver<Message>)
-> impl Future<Item = (), Error = ()>
{
    let transport = Transport;

    rx.for_each(move |pong_tx| {
        let start = Instant::now();

        transport.send_ping();

        transport.recv_pong()
            .map_err(|_| ())
            .and_then(move |_| {
                let rtt = start.elapsed();
                pong_tx.send(rtt).unwrap();
                Ok(())
            })
    })
}

/// Request an rtt.
fn rtt(tx: mpsc::Sender<Message>)
-> impl Future<Item = (Duration, mpsc::Sender<Message>), Error = ()>
{
    let (resp_tx, resp_rx) = oneshot::channel();

    tx.send(resp_tx)
        .map_err(|_| ())
        .and_then(|tx| {
            resp_rx.map(|dur| (dur, tx))
                .map_err(|_| ())
        })
}

# if false {
// Start the application
tokio::run(lazy(|| {
    // Create the channel that is used to communicate with the
    // background task.
    let (tx, rx) = mpsc::channel(1_024);

    // Spawn the background task:
    tokio::spawn(coordinator_task(rx));

    // Spawn a few tasks that use the coordinator to requst RTTs.
    for _ in 0..4 {
        let tx = tx.clone();

        tokio::spawn(lazy(|| {
            rtt(tx).and_then(|(dur, _)| {
                println!("duration = {:?}", dur);
                Ok(())
            })
        }));
    }

    Ok(())
}));
# }
```

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
[transport]: {{< ref "docs/going-deeper/frames.md" >}}
[rtt]: https://en.wikipedia.org/wiki/Round-trip_delay_time
