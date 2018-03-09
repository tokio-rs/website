+++
date = "2018-03-08"
title = "Announcing the Tokio runtime"
description = "08 March 2018"
menu = "blog"
weight = 104
+++

I'm happy to announce a new release of Tokio. This release includes the first
iteration of the Tokio Runtime.

## tl;dr

This is how a multi-threaded Tokio based server is now written:

```rust,ignore
extern crate tokio;

use tokio::net::TcpListener;
use tokio::prelude::*;

let addr = "127.0.0.1:8080".parse().unwrap();
let listener = TcpListener::bind(&addr).unwrap();

let server = listener.incoming()
    .map_err(|e| println!("error = {:?}", e))
    .for_each(|socket| {
        tokio::spawn(process(socket))
    });

tokio::run(server);
```

where `process` represents a user defined function that takes a socket and
returns a future that process it. In the case of an echo server, that might be
reading all data from the socket and writing it back to the same socket.

The [guides] and [examples] have been updated to use the runtime.

[guides]: https://tokio.rs/docs/getting-started/hello-world/
[examples]: https://github.com/tokio-rs/tokio/tree/master/examples

## What is the Tokio Runtime?

The Rust asynchronous stack is evolving to a set of loosely coupled components.
To get a basic networking application running, you need at a minimum an
asynchronous task executor and an instance of the Tokio reactor. Because
everything is decoupled, there are multiple options for these various
components, but this adds a bunch of boilerplate to all apps.

To help mitigate this, Tokio now provides the concept of a runtime. This is a
pre-configured package of all the various components that are necessary for
running the application.

This initial release of the runtime includes the reactor as well as a
[work-stealing] based thread pool for scheduling and executing the application's
code. This provides a multi-threaded default for applications.

The work-stealing default is ideal for most applications. It uses a similar
strategy as Go, Erlang, .NET, Java (the ForkJoin pool), etc... The
implementation provided by Tokio is designed for use cases where many
**unrelated** tasks are multiplexed on a single thread pool.

## Using the Tokio Runtime

As illustrated in the example above, the easiest way to use the Tokio runtime
is with two functions:

* `tokio::run`
* `tokio::spawn`.

The first function takes a future to seed the application and starts the
runtime. Roughly, it does the following:

1. Start the reactor.
2. Start the thread pool.
3. Spawn the future onto the thread pool.
4. Blocks the thread until the runtime becomes idle.

The runtime becomes idle once **all** spawned futures have completed and **all**
I/O resources bound to the reactor are dropped.

From within the context of a runtime. The application may spawn additional
futures onto the thread pool using `tokio::spawn`.

Alternatively, the [`Runtime`] type can be used directly. This allows for more
flexibility around setting up and using the runtime.

[`Runtime`]: #

## Future improvements

This is just the initial release of the Tokio runtime. Upcoming releases will
include additional functionality that is useful for Tokio based applications. A
blog post will be coming soon that goes into the roadmap in more detail.

The goal, as mentioned before, is to release early and often. Providing new
features to enable the community to experiment with them. Sometime in the next
few months, there will be a breaking release of the entire Tokio stack, so any
changes in the API need to be discovered before then.

## Tokio-core

There has also been a new release of `tokio-core`. This release updates
`tokio-core` to use `tokio` under the hood. This enables all existing
applications and libraries that currently depend on `tokio-core` (like Hyper) to
be able to use the improvements that come with the Tokio runtime without
requiring a breaking change.

Given the amount of churn that is expected to happen in the next few months,
we're hoping to help ease the transition across releases.

[work-stealing]: https://en.wikipedia.org/wiki/Work_stealing
