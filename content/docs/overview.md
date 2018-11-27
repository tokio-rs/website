---
title: "What is Tokio?"
weight: 1
menu: "docs"
---

Tokio allows developers to write asynchronous programs in the Rust programming
language. Instead of synchronously waiting for long-running operations like reading
a file or waiting for a timer to complete before moving on to the next thing,
Tokio allows developers to write programs where execution continues while the
long-running operations are in progress.

More specifically, Tokio is an event-driven, non-blocking I/O platform
for writing asynchronous applications with Rust. At a high level, it
provides a few major components:

* A multithreaded, work-stealing based task [scheduler].
* A [reactor] backed by the operating system's event queue (epoll, kqueue,
  IOCP, etc...).
* Asynchronous [TCP and UDP][net] sockets.

These components provide the runtime components necessary for building
an asynchronous application.

[net]: https://docs.rs/tokio/0.1/tokio/net/index.html
[reactor]: https://docs.rs/tokio/0.1/tokio/reactor/index.html
[scheduler]: https://tokio-rs.github.io/tokio/tokio/runtime/index.html

# Fast

Tokio is built on the Rust programming language, which is in of itself very
fast. Applications built with Tokio will get those same benefits. Tokio's design
is also geared towards enabling applications to be as fast as possible.

## Zero-cost abstractions

Tokio is built around [futures]. Futures aren't a new idea, but the way Tokio
uses them is [unique][poll]. Unlike futures from other languages, Tokio's
futures compile down to a state machine. There is no added overhead from
synchronization, allocation, or other costs common with future implementations.

Note that providing zero-cost abstractions does not mean that Tokio itself has
no cost. It means that using Tokio results in an end product with equivalent
overhead to not using Tokio.

[poll]: {{< ref "/docs/getting-started/futures.md" >}}#poll-based-futures
[futures]: {{< ref "/docs/getting-started/futures.md" >}}

## Concurrency

Out of the box, Tokio provides a multi-threaded, [work-stealing], scheduler. So,
when you start the Tokio runtime, you are already using all of your computer's
CPU cores.

Modern computers increase their performance by adding cores, so being able to
utilize many cores is critical for writing fast applications.

[work-stealing]: https://en.wikipedia.org/wiki/Work_stealing

## Non-blocking I/O

When hitting the network, Tokio will use the most efficient system available to
the operating system. On Linux this means [epoll], bsd platforms provide [kqueue],
and Windows has [I/O completion ports][iocp].

This allows multiplexing many sockets on a single thread and receiving
operating system notifications in batches, thus reducing system calls. All this
leads to less overhead for the application.

[epoll]: http://man7.org/linux/man-pages/man7/epoll.7.html
[kqueue]: https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2
[iocp]: https://docs.microsoft.com/en-us/windows/desktop/fileio/i-o-completion-ports

# Reliable

While Tokio cannot prevent all bugs, it is designed to minimize them. It does
this by providing APIs that are hard to misuse. At the end of the day, you can
ship applications to production with confidence.

## Ownership and type system

Rust's ownership model and type system enables implementing system level
applications without the fear of memory unsafety. It prevents classic bugs
such as accessing uninitialized memory and use after free. It does this without
adding any run-time overhead.

Further, APIs are able to leverage the type system to provide hard to misuse
APIs. For example, `Mutex` does not require the user to explicitly unlock.

## Backpressure

In push based systems, when a producer produces data faster than the consumer
can process, data will start backing up. Pending data is stored in memory.
Unless the producer stops producing, the system will eventually run out of
memory and crash. The ability for a consumer to inform the producer to slow down
is backpressure.

Because Tokio uses a [poll] based model, the problem mostly just goes away.
Producers are lazy by default. They will not produce any data unless the
consumer asks them to. This is built into Tokio's foundation.

## Cancellation

Because of Tokio's [poll] based model, computations do no work unless they are
polled. Dependents of that computation hold a [future][futures] representing the
result of that computation. If the result is no longer needed, the future is
dropped. At this point, the computation will no longer be polled and thus
perform no more work.

Thanks to Rust's ownership model, the computation is able to implement `drop`
handles to detect the future being dropped. This allows it to perform any
necessary cleanup work.

# Lightweight

Tokio scales well without adding overhead to the application, allowing it to
thrive in resource constrained environments.

## No garbage collector

Because Tokio is built on Rust, the compiled executable includes minimal
language run-time. The end product is similar to what C++ would produce. This
means, no garbage collector, no virtual machine, no JIT compilation, and no
stack manipulation. Write your server applications without fear of
[stop-the-world][gc] pauses.

It is possible to use Tokio without incurring any runtime allocations, making it
a good fit for [real-time] use cases.

[gc]: https://en.wikipedia.org/wiki/Garbage_collection_(computer_science)#Disadvantages
[real-time]: https://en.wikipedia.org/wiki/Real-time_computing

## Modular

While Tokio provides a lot out of the box, it is all organized very modularly.
Each component lives in a separate library. If needed, applications may opt to
pick and choose the needed components and avoid pulling in the rest.

Tokio leverages [`mio`] for the system event queue and [`futures`] for defining
tasks.  Tokio implements [async] syntax to improve readability of futures.
[Many] libraries implement Tokio, including [`hyper`] and [`actix`].

[`mio`]: https://carllerche.github.io/mio/mio/index.html
[`futures`]: https://docs.rs/futures/*/futures/
[async]: https://tokio.rs/blog/2018-08-async-await/
[Many]: https://crates.io/crates/tokio/reverse_dependencies
[`hyper`]: https://hyper.rs/guides/
[`actix`]: https://actix.rs/book/actix/

# Example

A basic TCP echo server with Tokio:

```rust
extern crate tokio;

use tokio::prelude::*;
use tokio::io::copy;
use tokio::net::TcpListener;

fn main() {
# }
# fn hax() {
    // Bind the server's socket.
    let addr = "127.0.0.1:12345".parse().unwrap();
    let listener = TcpListener::bind(&addr)
        .expect("unable to bind TCP listener");

    // Pull out a stream of sockets for incoming connections
    let server = listener.incoming()
        .map_err(|e| eprintln!("accept failed = {:?}", e))
        .for_each(|sock| {
            // Split up the reading and writing parts of the
            // socket.
            let (reader, writer) = sock.split();

            // A future that echos the data and returns how
            // many bytes were copied...
            let bytes_copied = copy(reader, writer);

            // ... after which we'll print what happened.
            let handle_conn = bytes_copied.map(|amt| {
                println!("wrote {:} bytes", amt.0)
            }).map_err(|err| {
                eprintln!("IO error {:?}", err)
            });

            // Spawn the future as a concurrent task.
            tokio::spawn(handle_conn)
        });

    // Start the Tokio runtime
    tokio::run(server);
}
```

More examples can be found [here](https://github.com/tokio-rs/tokio/tree/master/examples).
