---
title: "Overview"
---

Tokio is a collections of resources that allow developers to write safe, fast
and reliable asynchronous applications. Tokio leverages Rust's powerful type
system and trait resolution to empower developers to push the limits.

More specifically, Tokio is an event-driven, non-blocking I/O platform for
writing asynchronous applications with Rust. At a high level, it provides a few
major components:

- Tools for [working with asynchronous tasks][tasks], including [synchronization
  primitives and channels][sync] and [timeouts, delays, and intervals][time].
- APIs for [performing asynchronous I/O][io], including [TCP and UDP][net]
  sockets, [filesystem][fs] operations, and [process] and [signal] management.
- A [runtime] for executing asynchronous code, including a task scheduler, an
  I/O driver backed by the operating system's event queue (epoll, kqueue, IOCP,
  etc...), and a high performance timer.

These components provide the runtime components necessary for building an
asynchronous application.

[tasks]: https://docs.rs/tokio/*/tokio/#working-with-tasks
[sync]: https://docs.rs/tokio/*/tokio/sync/index.html
[time]: https://docs.rs/tokio/*/tokio/time/index.html
[io]: https://docs.rs/tokio/*/tokio/#asynchronous-io
[net]: https://docs.rs/tokio/*/tokio/net/index.html
[fs]: https://docs.rs/tokio/*/tokio/fs/index.html
[process]: https://docs.rs/tokio/*/tokio/process/index.html
[signal]: https://docs.rs/tokio/*/tokio/signal/index.html
[runtime]: https://docs.rs/tokio/*/tokio/runtime/index.html

# Fast

Tokio is _fast_. Built on top of the Rust programming language, which itself is
fast. Tokio takes advantage of adding minimal overhead and allowing the user to
tune it to their needs. This allows Tokio to be used in many situations and
continue to perform well.

# Reliable

Tokio is built on top of Rust's strong type system and novel trait resolution.
This enables users to build software with the ability to focus on the task at
hand instead of worrying if their code will work. Generally, if it compiles, it
will work.

Tokio also contains a very large test suite from integration tests to proper
concurrency tests using the [loom] model checker to provide the upmost
confidence.

Tokio also focuses heavily on providing consistent behavior with no surprises.
This means low latencies with un-heard of tail latencies. Tokio's major goal is
to allow users to deploy predictable software that will perform the same day in
and day out.

[loom]: https://github.com/tokio-rs/loom

# Easy

Tokio follows very closely to the standard libraries naming convention when it
makes sense. This allows easy conversion between code written with only the
standard library to code written with Tokio. With the strong type system, the
ability to deliver correct code easily is unparalleled.

# Flexible

Tokio provides multiple variations of the runtime. Everything from a
multi-threaded, [work-stealing] runtime to a light-weight, single-threaded
runtime. Each of these runtimes come with many knobs to allow users to tune them
to their needs.

[work-stealing]: https://en.wikipedia.org/wiki/Work_stealing

# Get started with Tokio

If you like to read code first, complete examples can be found
[here](https://github.com/tokio-rs/tokio/tree/master/examples), or keep reading
for a step-by-step tutorial.
