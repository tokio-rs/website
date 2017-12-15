+++
title = "Understanding event loops"
description = "The heart of asynchronous processing"
menu = "getting_started"
weight = 105
+++

Now we'll take a bit more of a dive into `tokio-core`. Keep in mind that this
layer of the stack is intended mainly for lower-level async programming;
`tokio-proto` is generally nicer to work with when it meets your needs. Still,
it can be helpful to understand how `tokio-core` works whether or not you use it
directly.

Almost all asynchronous libraries are powered in one form or another by an
**event loop**. That's just a fancy term for code like this executing
on a thread:

```rust,ignore
loop {
    // Learn what the next "event" was, blocking if none available
    let event = next_event();

    // Dispatch this event, following it through to completion
    dispatch(event);
}
```

So an event loop is literally a `loop` that blocks, waiting for the next "event"
in an asynchronous system, and then acts on the event appropriately. Events
cover a wide spectrum:

* A socket is now readable
* An I/O write has finished
* External work for a future has completed, and it can make progress
* A timeout fired

The "dispatch" above is also very general; it just means "taking appropriate
action" to respond to an event, for example, by scheduling a write after a read
is finished, attempting to complete a future's state machine, or starting
handling timeout logic for a timeout which fired.

## [The event loop of `tokio-core`](#event-loop) {#event-loop}

The heart of the `tokio-core` library is the [`tokio_core::reactor`] module;
"reactor" is a common synonym for "event loop". The module contains the [`Core`]
type, which is the actual event loop, as well as the [`Handle`] and [`Remote`]
types, which are used to send messages and interact with the event loop without
holding the [`Core`].

### [`Core`](#core) {#core}

The [`Core`] type has a relatively small API surface area; the main item of
interest is the [`run`][`Core::run`] method. This method takes a future, `F`,
and starts executing an event loop on the current thread until the future `F` is
completed. While this may look similar to [`Future::wait`], there's a crucial
difference: while it's waiting for the future to resolve, it executes other work
on the event loop rather than just blocking the thread. As we saw in the
[previous section](../streams-and-sinks), that other work includes tasks that
were spawned onto the event loop.

Most servers consist of some setup, followed by running the event loop with a
connection-handling future, as we also saw before. To recap, the basic structure
looks as follows:

```rust,no_run
# #![deny(deprecated)]
extern crate futures;
extern crate tokio_core;

use futures::Stream;
use tokio_core::net::TcpListener;
use tokio_core::reactor::Core;

fn main() {
    let mut core = Core::new().unwrap();
    let listener = TcpListener::bind(&"127.0.0.1:8080".parse().unwrap(),
                                     &core.handle()).unwrap();

    let server = listener.incoming().for_each(|(client, client_addr)| {
        // process `client` by spawning a new task ...

        Ok(()) // keep accepting connections
    });

    core.run(server).unwrap();
}
```

For clients, however, you can use the [`run`][`Core::run`] method for one-off
futures or otherwise one-off tasks. Some pseudo-code for this could look like:

```rust,ignore
let my_request = http::get("https://www.rust-lang.org");
let my_response = my_context.core.run(my_request).unwrap();
```

The [`Core`] could be stashed in a local context which is used whenever
executing a future, but is otherwise idle while the client is processing other
tasks. Alternatively a thread could be spawned on a client running a [`Core`]
and work could be shipped over to it whenever necessary and returned later;
we'll see how to do that with [`Remote`] in just a moment.

### [`Handle`](#handle) {#handle}

In general, the code being run by the event loop needs the ability to make
additional requests of the event loop, and thus needs some way to access the
loop. Consequently, the [`Core`] type provides the ability to acquire an owned
*handle* to itself through the [`Handle`] type created through the
[`Core::handle`] method.

Let's first take a look at the `Handle`'s [`spawn`][`Handle::spawn`] method. Like
[`Core::run`], [`spawn`][`Handle::spawn`] will ensure the provided future runs to
completion. Unlike [`Core::run`], however, spawning requires the item/error type
of a future to be `()` and also requires the `'static` bound. The requirement of
`()` signifies that future is executed in the background of the event loop to
completion and must have its own error handling.

As we saw in the last section, the [`spawn`][`Handle::spawn`] method is useful
for spawning off work dynamically onto an event loop. All spawned work *is
executed concurrently* on the event loop thread, which is typically ideal, for
example, when handling TCP connections. Taking our `run` example from before, we
could enhance it by handling all clients concurrently by adding:

```rust,ignore
// Acquire a `Handle` and then use that to spawn work for each client as
// they're accepted from the TCP socket.
let handle = core.handle();
let server = listener.incoming().for_each(|(client, _client_addr)| {
    handle.spawn(process(client));

    Ok(()) // keep accepting connections
});
```

and add a `process` function for handling a client:

```rust,ignore
// Here we'll express the handling of `client` and return it as a future
// to be spawned onto the event loop.
fn process(client: TcpStream) -> Box<Future<Item = (), Error = ()>> {
    // ...
}
```

Beyond spawning threads, a [`Handle`] is also used for constructing objects
associated with the event loop. For example, the [`TcpListener::bind`] method
that we've been using takes a `&Handle` as its second argument.

### [`Remote`](#remote) {#remote}

With [`Handle`], we're able to retain a reference to the event loop without
holding a [`Core`]. To provide substantial performance benefits, the [`Handle`]
type is not sendable across threads; it is only usable on the event loop
thread. If you need to communicate with the event loop from a different thread,
you can use the [`Remote`] type.

A [`Remote`] is a "downgraded" [`Handle`] created by calling the [`remote`]
method on a [`Handle`]. The [`Remote`] type currently has only
a [`spawn`][`Remote::spawn`] method. Unlike [`Handle::spawn`], [`Remote::spawn`]
takes a *closure* that creates a future and must be `Send` (i.e. it can be sent
across threads).

When the closure is run, it must yield a [`Handle`] as proof that it's running
on the same thread as the event loop. This handle can then be used to create and
work with I/O objects. The created future is spawned onto the event loop to be
executed locally.

Like [`Handle::spawn`], the [`Remote::spawn`] method requires the item/error
types of the future to be `()` as it's run concurrently.

[IOCP]: https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2
[`Core::handle`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Core.html#method.handle
[`Core::run`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Core.html#method.run
[`Core`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Core.html
[`Event`]: https://docs.rs/mio/0.6/mio/struct.Event.html
[`Future::wait`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.wait
[`remote`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Handle.html#method.remote
[`Handle::spawn`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Handle.html#method.spawn
[`Handle`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Handle.html
[`Poll::poll`]: https://docs.rs/mio/0.6/mio/struct.Poll.html#method.poll
[`Poll`]: https://docs.rs/mio/0.6/mio/struct.Poll.html
[`Remote::spawn`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Remote.html#method.spawn
[`Remote`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Remote.html
[`TcpListener::bind`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.TcpListener.html#method.bind
[`TcpListener`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.TcpListener.html
[`TcpStream`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.TcpStream.html
[`Token`]: https://docs.rs/mio/0.6/mio/struct.Token.html
[`UdpSocket`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.UdpSocket.html
[`epoll`]: http://man7.org/linux/man-pages/man7/epoll.7.html
[`futures`]: https://docs.rs/futures/0.1
[`kqueue`]: https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2
[`mio`]: https://docs.rs/mio/0.6
[`tokio_core::reactor`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/index.html
[`tokio-core`]: https://docs.rs/tokio-core/0.1
[`tokio_core::net`]: https://docs.rs/tokio-core/0.1/tokio_core/net/
[`std::net`]: https://doc.rust-lang.org/std/net/
[`TcpStream::connect`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.TcpStream.html#method.connect
[`TcpListener::incoming`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.Incoming.html
[`read_to_end`]: https://docs.rs/tokio-core/0.1/tokio_core/io/fn.read_to_end.html
[`write_all`]: https://docs.rs/tokio-core/0.1/tokio_core/io/fn.write_all.html
[`Io`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Io.html
[`Io::split`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Io.html#method.split
[`Io::framed`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Io.html#method.framed
[`Framed`]: https://docs.rs/tokio-core/0.1/tokio_core/io/struct.Framed.html
[`Read`]: https://doc.rust-lang.org/std/io/trait.Read.html
[`Write`]: https://doc.rust-lang.org/std/io/trait.Write.html
[`Stream`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html
[`Sink`]: https://docs.rs/futures/0.1/futures/sink/trait.Sink.html
[`Stream::split`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.split
[`EasyBuf`]: https://docs.rs/tokio-core/0.1.1/tokio_core/io/struct.EasyBuf.html
[`EasyBuf::drain_to`]: https://docs.rs/tokio-core/0.1.1/tokio_core/io/struct.EasyBuf.html#method.drain_to
[`tokio-proto`]: https://github.com/tokio-rs/tokio-proto
[`send_dgram`]: https://docs.rs/tokio-core/0.1.1/tokio_core/net/struct.UdpSocket.html#method.send_dgram
[`recv_dgram`]: https://docs.rs/tokio-core/0.1.1/tokio_core/net/struct.UdpSocket.html#method.recv_dgram
[`UdpSocket::framed`]: https://docs.rs/tokio-core/0.1.1/tokio_core/net/struct.UdpSocket.html#method.framed
[`UdpCodec`]: https://docs.rs/tokio-core/0.1.1/tokio_core/net/trait.UdpCodec.html
