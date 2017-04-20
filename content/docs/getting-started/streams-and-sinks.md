+++
title = "Streams and sinks"
description = "High-level async programming"
menu = "getting_started"
weight = 104
+++

We've now seen a few examples of futures, which represent a *one-time*
asynchronous event. But there are a lot of cases where you want to deal with a
*series* of events:

- incoming connections over time,
- incoming or outgoing network packets,
- incoming or outgoing chunks of a streaming protocol,
- repeated timeouts

and so on.

The `futures` library provides two abstractions that are similar to futures,
but work with series of events over time: streams and sinks. Streams are for
incoming events (which are caused by something external happening, like a
timeout firing) while sinks are for outgoing events (like sending a message
chunk).

## [Streams](#streams) {#streams}

Let's see how [`Future`] and [`Stream`] relate to their synchronous equivalents
in the standard library:

| # items | Sync | Async      | Common operations                              |
| ----- | -----  | ---------- | ---------------------------------------------- |
| 1 | [`Result`]   | [`Future`] | [`map`], [`and_then`]                        |
| ∞ | [`Iterator`] | [`Stream`] | [`map`][stream-map], [`fold`], [`collect`]   |

[`Future`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html
[`Stream`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html
[`Result`]: https://doc.rust-lang.org/std/result/enum.Result.html
[`map`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.map
[`and_then`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.and_then
[stream-map]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.map
[`fold`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.fold
[`collect`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.collect
[`Iterator`]: https://doc.rust-lang.org/std/iter/trait.Iterator.html

The definition of the [`Stream`] trait also resembles that of [`Iterator`]:

```rust,ignore
trait Stream {
    // The type of item yielded each time the stream's event occurs
    type Item;

    // The error type; errors terminate the stream.
    type Error;

    // Try to produce a value.
    fn poll(&mut self) -> Poll<Option<Self::Item>, Self::Error>;

    // ... and many default methods; we'll see some of them below.
}
```

The [`Stream`] trait is very similar to the [`Future`] trait, except that a
stream's [`poll`][stream-poll] method returns `Option<Self::Item>` instead of
`Self::Item`. The semantics are much like with [`Iterator`]: yielding `None`
means that the stream has terminated. Like futures, streams can produce
errors, which *also* terminate the stream.

[stream-poll]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#tymethod.poll

The stream API is easiest to understand by example, so let's write a little
server that immediately sends "Hello, world!" to each client that connects, and
then hangs up. (We'll use `tokio-core` in this example, which is covered in
greater depth in the next section.)

```rust,no_run
extern crate futures;
extern crate tokio_core;
extern crate tokio_io;

use futures::stream::Stream;
use tokio_core::reactor::Core;
use tokio_core::net::TcpListener;

fn main() {
    let mut core = Core::new().unwrap();
    let address = "0.0.0.0:12345".parse().unwrap();
    let listener = TcpListener::bind(&address, &core.handle()).unwrap();

    let connections = listener.incoming();
    let welcomes = connections.and_then(|(socket, _peer_addr)| {
        tokio_io::io::write_all(socket, b"Hello, world!\n")
    });
    let server = welcomes.for_each(|(_socket, _welcome)| {
        Ok(())
    });

    core.run(server).unwrap();
}
```

That was easy! Let's pick apart a few key lines. First, there's the *reactor setup*:

```rust,ignore
let mut core = Core::new().unwrap();
```

We'll cover reactors (aka *event loops*) in detail in the next section. For now,
it's enough to know that if you're doing asynchronous I/O, it needs to be
managed by a reactor. The `tokio-proto` crate takes care of this for you, but
here we're working at a lower level.

We then set up an async TCP listener, associated with that reactor:

```rust,ignore
let listener = TcpListener::bind(&address, &core.handle()).unwrap();
```

Our first encounter with streams is the `incoming` stream:

```rust,ignore
let connections = listener.incoming();
```

This is an unending stream of sockets, one for each
incoming connection. It's an async version of
[the same method](https://static.rust-lang.org/doc/master/std/net/struct.TcpListener.html#method.incoming)
in the standard library. And just as with iterators, we can use the methods on
the [`Stream`] trait to manipulate the stream:

[`TcpStream`]: https://docs.rs/tokio-core/0.1.2/tokio_core/net/struct.TcpStream.html

```rust,ignore
let welcomes = connections.and_then(|(socket, _peer_addr)| {
    tokio_io::io::write_all(socket, b"Hello, world!\n")
});
```

Here we use [`and_then`][stream-and-then] to perform an action over each item of
the stream, a bit like `and_then` on `Result`, except that the closure we give
`and_then` produces a future. We get back a *new* stream, `welcomes`. Here's how
`welcome` produces its items:

- First, get an item from `connections`.
- Then, map that item through the closure, getting back a future.
- When that future completes, return the item it produced as the next item of
  the `welcomes` stream.

The future we use is [`write_all`] from the `tokio-io` crate. It
asynchronously writes the entire buffer to the socket provided, then returns
the socket and ownership of that buffer. So `welcomes` is again a stream that
includes one socket for each connection, with `Hello, world!` written to them.
We're done with the connection at that point.

How do we actually consume this stream? As with iterators, loops are a common
way to consume streams---but we use the futures-based [`for_each`] method:

```rust,ignore
let server = welcomes.for_each(|(_socket, _welcome)| {
    Ok(())
})
```

Here we take the results of the previous future, [`write_all`], and discard
them, closing the socket. What we get back is a *single future*, `server`, which
completes with `()` only when the entire stream has been exhausted (and hence,
we've replied to all connections). It's a pretty common pattern, when working
with streams, to ultimately "bottom things out" into a single future that
represents fully processing the stream.

[`for_each`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.for_each
[`write_all`]: https://docs.rs/tokio-io/0.1/tokio_io/io/fn.write_all.html
[stream-and-then]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.and_then

There's one final step: we need to consume the `server` future, which is
otherwise inert, to actually trigger all this processing. We also need to start
up the reactor. We do both in a single step, by using the server as the *primary
future* of the reactor:

```rust,ignore
core.run(server).unwrap();
```

The reactor's event loop will keep running on the current thread until the
server future completes successfully or with an error.

##### [Concurrency](#concurrency) {#concurrency}

There's an important point to drive home about the previous example: it has *no
concurrency*!  Streams represent in-order processing of data, and in this case
the order of the original stream is the order in which sockets are received,
which the [`and_then`][stream-and-then] and [`for_each`] combinators
preserve. Chaining these combinators therefore has the effect of taking each
socket from the stream and processing all chained operations on it before taking
the next socket.

If, instead, we want to handle all clients concurrently, we can use the
reactor's ability to "spawn" additional work:

[`spawn`]: https://tokio-rs.github.io/tokio-core/tokio_core/reactor/struct.Handle.html#method.spawn

```rust,ignore
let handle = core.handle();
let server = connections.for_each(|(socket, _peer_addr)| {
    let serve_one = tokio_io::io::write_all(socket, b"Hello, world!\n")
            .then(|_| Ok(()));
    handle.spawn(serve_one);
    Ok(())
});
```

Note that [`spawn`] requires a future with `()` item and error types, since the
result of the future is not accessible. We use `then` to explicitly throw away
the socket returned from [`write_all`].

Unlike with `CpuPool`, the reactor is always an event loop that runs on a
*single* thread (the one that calls `run`). When we use [`spawn`] to add work to
the reactor, we are effectively creating a *lightweight thread*: we move the
future itself onto the reactor, and as relevant events arrive, the reactor will
attempt to run the future to completion. It's important to be clear on the
mechanics here, so let's work through an example.

After calling `core.run`, the event loop blocks until a connection
arrives. Suppose two connections arrive at the same time.  At that point, the
event loop will emit two sockets on the `connections` stream, which will result
in two spawned `Hello, world!` futures. The event loop will then attempt to
complete those futures, one at a time.  Each future will attempt to write to
its socket. If its socket is not ready to receive data, the future will go into
a *waiting state* until the status of the socket changes; the event loop *does
not* block. Once the socket *is* ready, the event loop will again start trying
to make progress on the future.

So we end up multiplexing all connection handling onto a single event loop
thread. That thread will make progress on all outstanding futures with I/O ready
to be performed, and will not be blocked by any future that has stalled waiting
for a socket. For a server as simple as this one, handling concurrency by
multiplexing onto a single thread is a big performance win compared to
coordinating multiple threads. In other cases, we might use a `CpuPool` for
CPU-heavy work, and use the event loop primarily for I/O-heavy work, to try to
maximize locality and parallelism.

All of the multiplexing and dispatch is handled behind the scenes by the reactor
and futures; we just write code that looks pretty close to synchronous code that
spawns a thread per connection.

## [Sinks](#sinks) {#sinks}

Sinks are essentially the opposite of streams: they are places that you can
asynchronously send many values over time. As usual, sinks are types that
implement the `Sink` trait:

```rust,ignore
trait Sink {
    // The type of value that the sink accepts.
    type SinkItem;

    // The type of value produced by the sink when an error occurs.
    type SinkError;

    // The analog to `poll`, used for sending and then flushing items.
    fn start_send(&mut self, item: Self::SinkItem)
                  -> StartSend<Self::SinkItem, Self::SinkError>;

    fn poll_complete(&mut self) -> Poll<(), Self::SinkError>;

    fn close(&mut self) -> Poll<(), Self::SinkError>;

    // ... and lots of default methods, as usual
}
```

We'll see some example uses of sinks in the next section, so for now we'll just
mention two of the most important methods it offers:

* The [`send_all`] method takes a stream with `Item` the same as `SinkItem`, and
  gives you back a future that produces `()`. As the name suggests, this future,
  when executed, will asynchronously send all items from the stream into the
  sink, completing when the stream has been exhausted and all items have been
  *flushed* through the sink.

* The [`buffer`] method wraps a sink with a fixed-size buffer, allowing it to
  accept additional items even when the underlying sink is not ready for
  items. That's useful for buffering up responses on a socket, for example.

[`send_all`]: https://docs.rs/futures/0.1/futures/sink/trait.Sink.html#method.send_all
[`buffer`]: https://docs.rs/futures/0.1/futures/sink/trait.Sink.html#method.buffer

Most of the time, the interesting work happens on the stream and future sides,
with sinks acting as a final endpoint for pushing data through.
