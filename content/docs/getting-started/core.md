+++
title = "High-level I/O using core"
description = "Future, stream and sink-based APIs from tokio-core"
menu = "getting_started"
weight = 6
+++

At this point we've got a pretty solid grasp on what event loops are and how
[`Core`] allows us to work with futures on an event loop. Let's get down to
business and do some I/O! In this section, we'll cover "high-level" I/O with
`tokio-core`, where we'll work with futures, streams and sinks. A
[later section](../../going-deeper/core-low-level) will explain how to work at
the lowest level with `tokio-core`, which gives you maximal control over things
like buffering strategy.

### [Concrete I/O types](#concrete-io) {#concrete-io}

The [`tokio-core`] crate doesn't provide a full suite of I/O primitives; it's
focused on TCP/UDP networking types. That's because these are the only I/O
objects that you can work with asynchronously across Rust's main platforms.

In the [`tokio_core::net`] module you'll find types like
[`TcpListener`] we've been using in examples prior, [`TcpStream`], and
[`UdpSocket`]. These networking types serve as the core foundation for most
servers and should look very similar to their [standard library
counterparts][`std::net`].

The main difference between [`tokio_core::net`] and [`std::net`] is that the
Tokio versions are all *non-blocking*. The `Read`/`Write` trait implementations
are not blocking and will return a "would block" error instead of blocking (see
the [low-level I/O section](../../going-deeper/core-low-level) for more).
Similarly types are also enhanced with futures-aware methods such as
[`TcpStream::connect`] returning a future or [`TcpListener::incoming`] returning
a stream.

### [I/O helpers](#io-helpers) {#io-helpers}

In addition to the concrete networking types [`tokio-core`] also provides a
number of utilities in the [`tokio_core::io`] module for working with I/O
objects When using these utilities, it's important to remember a few points:

* They only work with "futures aware" and nonblocking
  implementations of `Read`/`Write`, though this should be the default if Tokio
  types are used internally.
* They are intended to be *helpers*. For your particular use case they may not
  always be the most efficient. The helpers are intended to help you hit the
  ground running and can easily be replaced with application-specific logic in
  the future if necessary.

The [`tokio_core::io`] module provides a suite of helper functions to express
I/O operations as futures, such as [`read_to_end`] or [`write_all`]. The
functions take the I/O object, and any relevant buffers, by value. The resulting
futures then yield back ownership of these values, so you can continue using
them.  Threading ownership in this way is necessary in part because futures are
often required to be `'static`, making borrowing impossible.

In addition to these functions, the module includes an [`Io`] trait. This trait
expresses the concept of an I/O object which implements both [`Read`] and
`Write`. [`Io`] currently doesn't have any required methods, but two methods
with default implementations are of particular note.

The [`Io::split`] method assists in working with "halves" of a stream
independently. This method essentially takes a `Read + Write` objects and
returns two objects that implement [`Read`] and `Write`, respectively. This can
often be convenient when working with futures to ensure ownership is
managed correctly.

The second method, [`Io::framed`], is important enough that we'll give it a
whole section!

### [I/O codecs and framing](#io-codecs) {#io-codecs}

Working with a raw stream of bytes isn't always the easiest thing to do,
especially in an asynchronous context. Additionally, many protocols aren't
really byte-oriented but rather have a higher level "framing" they're using.
Often this means that abstractions like [`Stream`] and [`Sink`] from the
[`futures`] crate are a perfect fit for a protocol, and you just need to somehow
get a stream of bytes into a [`Stream`] and `Sink`. Thankfully, [`tokio-core`]
helps you do exactly this with the last method of the [`Io`] trait,
[`Io::framed`].

The [`Io::framed`] method takes a [`Codec`] which defines how to take a stream
and sink of bytes to a literal [`Stream`] and [`Sink`] implementation. This
method will return a [`Framed`] which implements the [`Sink`] and [`Stream`]
traits, using the [`Codec`] provided to decode and encode frames. Note that a
[`Framed`] can be split with [`Stream::split`] into two halves (like
[`Io::split`]) if necessary.

As we saw [much earlier](../simple-server), a [`Codec`] defines how to decode
data received on the I/O stream, as well as how to encode frames back into the
I/O stream. This sort of operation requires some level of buffering which is
typically quite a tricky topic in asynchronous I/O handling. The [`Codec`] trait
provides an [`EasyBuf`] for decoding which is essentially a reference-counted
owned list of bytes. This allows efficient extraction of slices of the buffer
through [`EasyBuf::drain_to`]. For encoding a [`Codec`] simply append bytes to
the provided `Vec`.

As with other helpers in [`tokio_core::io`] the [`Codec`] trait may not
perfectly suit your application, particularly with respect to buffering
strategies. Fear not, though, as the [`Io::framed`] method is just meant to get
you up and running quickly. Crates like [`tokio-proto`] work with a [`Stream`]
and a [`Sink`] directly, so you can swap out [`Io::framed`] with your own
implementation if it becomes a bottleneck.

### [Datagrams](#datagrams) {#datagrams}

Note that most of this discussion has been around I/O or byte *streams*, which
UDP importantly is not! To accommodate this, however, the [`UdpSocket`] type
also provides a number of methods for working with it conveniently:

* [`send_dgram`] allows you to express sending a datagram as a future, returning
  an error if the entire datagram couldn't be sent at once.
* [`recv_dgram`] expresses reading a datagram into a buffer, yielding both the
  buffer and the address it came from.
* [`framed`][`UdpSocket::framed`] acts similarly to [`Io::framed`] in easing
  transformation of a [`UdpSocket`] to a [`Stream`] and a [`Sink`]. Note that
  this method takes a [`UdpCodec`] which differs from [`Codec`] to better suit
  datagrams as opposed to a byte stream.

[IOCP]: https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2
[`Core::handle`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Core.html#method.handle
[`Core::run`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Core.html#method.run
[`Core`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Core.html
[`Event`]: https://docs.rs/mio/0.6/mio/struct.Event.html
[`Future::wait`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.wait
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
[`tokio_core::io`]: https://docs.rs/tokio-core/0.1/tokio_core/io/
[`read_to_end`]: https://docs.rs/tokio-core/0.1/tokio_core/io/fn.read_to_end.html
[`write_all`]: https://docs.rs/tokio-core/0.1/tokio_core/io/fn.write_all.html
[`Io`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Io.html
[`Io::split`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Io.html#method.split
[`Io::framed`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Io.html#method.framed
[`Codec`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Codec.html
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
