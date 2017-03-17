+++
date = "2017-03-16"
title = "Announcing the tokio-io Crate"
description = "16 March 2017"
menu = "blog"
+++

Today we're happy to announce a new crates and several new tools to work with
in the Tokio stack. This represents the culmination of a number of parallel
updates to various bits and pieces, they just happened to conveniently land all
around the same time! In a nutshell the improvements are:

* A new [tokio-io] crate extracted from [tokio-core], deprecating the
  [`tokio_core::io`] module.
* Introduction of the [bytes] crate to [tokio-io] allowing abstraction over
  buffering and leveraging underlying functionality like vectored I/O.
* Addition of a new method, `close`, to the `Sink` trait to express graceful
  shutdown.

These changes improve the organization and abstractions of Tokio to address
several long-standing concerns and should provide a stable foundation for all
future development. At the same time, the changes are not breaking since the
old `io` module is still available in deprecated form. You can start using all
these crates immediately via `cargo update` and using the most recent `0.1.*`
versions of the crates!

Let's dive a bit more into each change in detail to see what's available now.

## Adding a `tokio-io` crate

The existing [`tokio_core::io`] module gives a number of useful abstractions
but they're not specific to [tokio-core] itself, and the major purpose of the
[tokio-io] crate is to provide these core utilities without the implication of
a runtime. With [tokio-io] crates can depend on asynchronous I/O semantics
without tying themselves to a particular runtime, for example [tokio-core].
The [tokio-io] crate is intended to be similar to the [`std::io`] standard
library module in terms of serving a common abstraction for the asynchronous
ecosystem. The concepts and traits set forth in [tokio-io] are the foundation
for all I/O done in the Tokio stack.

The primary contents of [tokio-io] are the [`AsyncRead`] and [`AsyncWrite`]
traits. These two traits are sort of a "split [`Io`] trait" and were chosen to
demarcate types which implement Tokio-like read/write semantics (nonblocking
and notifying to a future's task). These traits then integrate with the [bytes]
crate to provide some convenient functions and retain old functionality like
[`split`].

With a clean slate we also took the chance to refresh the [`Codec`] trait in the
[tokio-core] crate to [`Encoder`] and [`Decoder`] traits which operate over
types in the [bytes] crate ([`EasyBuf`] is not present in [tokio-io] and it's
now deprecated in [tokio-core]). These types allows you to quickly move from a
stream of bytes to a [`Sink`] and a [`Stream`] ready to accept framed messages.
A great example of this is that with [tokio-io] we can use the new
[`length_delimited`] module combined with [tokio-serde-json] to get up and
running with a JSON RPC server in no time as we'll see later in this post.

Overall with [tokio-io] we were also able to revisit several minor issues in
the API designed. This in turns empowered us to [close a slew of
issues][closing] against [tokio-core]. We feel [tokio-io] is a great addition
to the Tokio stack moving forward. Crates can choose to be abstract over
[tokio-io] without pulling in runtimes such as [tokio-core], if they'd like.

## Integration with `bytes`

One longstanding wart with [tokio-core] is its [`EasyBuf`] byte buffer type.
This type is basically what it says on the tin (an "easy" buffer) but is
unfortunately typically not what you want in high performance use cases. We've
long wanted to have a better abstraction (and a better concrete implementation)
here.

With [tokio-io] you'll find that the [bytes] crate on [crates.io] is much more
tightly integrated and provides the abstractions necessary for high-performance
and "easy" buffers simultaneously. The main contents of the [bytes] crate are
the [`Buf`] and [`BufMut`] traits. These two traits serve as the ability to
abstract over arbitrary byte buffers (both readable and writable) and are
integrated with [`read_buf`] and [`write_buf`] on all asynchronous I/O objects
now.

In addition to traits to abstract over many kinds of buffers the [bytes] crate
comes with two high-quality implementations of these traits, the [`Bytes`] and
[`BytesMut`] type (implementing the [`Buf`] and [`BufMut`] traits respectively).
In a nutshell these types represent reference-counted buffers which allows
zero-copy extraction of slices of data in an efficient fashion. To boot they
also support a wide array of common operations such as tiny buffers (inline
storage), single owners (can use a `Vec` internally), shared owners with
disjoint views (`BytesMut`), and shared owners with possibly overlapping views
(`Bytes`).

Overall the [bytes] crate we hope is your one-stop-shop for byte buffer
abstractions as well as high-quality implementations to get you running
quickly. We're excited to see what's in store for the [bytes] crate!

## Addition of `Sink::close`

The final major change that we've landed recently is the addition of a new
method on the [`Sink`] trait, [`close`]. Up to now there hasn't been a great
story around implementing "graceful shutdown" in a generic fashion because there
was no clean way to indicate to a sink that no more items will be pushed into
it. The new [`close`] method is intended precisely for this purpose.

The [`close`] method allows informing a sink that no more messages will be
pushed into it. Sinks can then take this opportunity to flush messages and
otherwise perform protocol-specific shutdown. For example a TLS connection at
that point would initiate a shutdown operation or a proxied connection might
issue a TCP-level shutdown. Typically this'll end up bottoming out to the new
[`AsyncWrite::shutdown`] method.

## Addition of `codec::length_delimited`

One large feature that is landing with [tokio-io] is the addition of
the [`length_delimited`] module (inspired by Netty's
[`LengthFieldBasedFrameDecoder`]). Many protocols delimit frames by using a
frame header that includes the length of the frame. As a simple example, take a
protocol that uses a frame header of a `u32` to delimit the frame payload. Each
frame on the wire looks like this:

```text
+----------+--------------------------------+
| len: u32 |          frame payload         |
+----------+--------------------------------+
```

Parsing this protocol can easily be handled with
[`length_delimited::Framed`]:

```rust,ignore
// Bind a server socket
let socket = TcpStream::connect(
    &"127.0.0.1:17653".parse().unwrap(),
    &handle);

socket.and_then(|socket| {
    // Delimit frames using a length header
    let transport = length_delimited::FramedWrite::new(socket);
})
```

In the above example, `transport` will be a `Sink + Stream` of buffer
values, where each buffer contains the frame payload. This makes
encoding and decoding the frame to a value fairly easy to do with
something like [serde]. For example, using [tokio-serde-json], we can
quickly implement a JSON based protocol where each frame is length
delimited and the frame payload is encoded using JSON:

```rust,ignore
// Bind a server socket
let socket = TcpStream::connect(
    &"127.0.0.1:17653".parse().unwrap(),
    &handle);

socket.and_then(|socket| {
    // Delimit frames using a length header
    let transport = length_delimited::FramedWrite::new(socket);

    // Serialize frames with JSON
    let serialized = WriteJson::new(transport);

    // Send the value
    serialized.send(json!({
        "name": "John Doe",
        "age": 43,
        "phones": [
            "+44 1234567",
            "+44 2345678"
        ]
    }))
})
```

The full example is [here](https://github.com/carllerche/tokio-serde-json/tree/master/examples).

The [`length_delimited`] module contains enough configuration settings to
handle parsing length delimited frames with more complex frame headers,
like the HTTP/2.0 protocol.

[serde]: https://serde.rs/
[tokio-serde-json]: https://github.com/carllerche/tokio-serde-json
[`length_delimited::Framed`]: https://docs.rs/tokio-io/0.1/tokio_io/codec/length_delimited/struct.Framed.html
[`LengthFieldBasedFrameDecoder`]: https://netty.io/4.0/api/io/netty/handler/codec/LengthFieldBasedFrameDecoder.html

## What's next?

All of these changes put together closes quite a large number of issues in the
[futures] and [tokio-core] crates and we feel positions Tokio precisely where
we'd like it for common I/O and buffering abstractions. As always we'd love to
hear feedback on issue trackers and are more than willing to merge PRs if you
find a problem! Otherwise we look forward to seeing all of these changes in
practice!

With the foundations of [tokio-core], [tokio-io], [tokio-service], and
[tokio-proto] solidifying the Tokio team is looking forward to accommodating
and implementing more ambitious protocols such as HTTP/2. We're working closely
with [@seanmonstar][sean] and [Hyper] to develop these foundational HTTP
libraries as well. Finally we're looking to expand the middleware story in the
near future both with relation to HTTP and generic [tokio-service]
implementations. More on this coming soon!

[`AsyncWrite::shutdown`]: https://docs.rs/tokio-io/0.1/tokio_io/trait.AsyncWrite.html#tymethod.shutdown
[`close`]: https://docs.rs/futures/0.1/futures/sink/trait.Sink.html#method.close
[`Bytes`]: http://carllerche.github.io/bytes/bytes/struct.Bytes.html
[`BytesMut`]: http://carllerche.github.io/bytes/bytes/struct.BytesMut.html
[`read_buf`]: https://docs.rs/tokio-io/0.1/tokio_io/trait.AsyncRead.html#method.read_buf
[`write_buf`]: https://docs.rs/tokio-io/0.1/tokio_io/trait.AsyncWrite.html#method.write_buf
[`Buf`]: http://carllerche.github.io/bytes/bytes/trait.Buf.html
[`BufMut`]: http://carllerche.github.io/bytes/bytes/trait.BufMut.html
[crates.io]: https://crates.io
[tokio-io]: https://crates.io/crates/tokio-io
[futures]: https://crates.io/crates/futures
[tokio-core]: https://crates.io/crates/tokio-core
[tokio-service]: https://crates.io/crates/tokio-service
[tokio-proto]: https://crates.io/crates/tokio-proto
[bytes]: https://crates.io/crates/bytes
[`tokio_core::io`]: https://docs.rs/tokio-core/0.1/tokio_core/io/
[`Io`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Io.html
[`Codec`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Codec.html
[`Stream`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html
[`Sink`]: https://docs.rs/futures/0.1/futures/sink/trait.Sink.html
[`std::io`]: https://doc.rust-lang.org/std/io/
[`AsyncWrite`]: https://docs.rs/tokio-io/0.1/tokio_io/trait.AsyncWrite.html
[`AsyncRead`]: https://docs.rs/tokio-io/0.1/tokio_io/trait.AsyncRead.html
[`split`]: https://docs.rs/tokio-io/0.1/tokio_io/trait.AsyncRead.html#method.split
[`Encoder`]: https://docs.rs/tokio-io/0.1/tokio_io/codec/trait.Encoder.html
[`Decoder`]: https://docs.rs/tokio-io/0.1/tokio_io/codec/trait.Decoder.html
[`EasyBuf`]: https://docs.rs/tokio-core/0.1/tokio_core/io/struct.EasyBuf.html
[`length_delimited`]: https://docs.rs/tokio-io/0.1/tokio_io/codec/length_delimited/index.html
[closing]: https://github.com/tokio-rs/tokio-core/issues/61#issuecomment-277568977
[tokio-serde-json]: https://github.com/carllerche/tokio-serde-json
[sean]: https://github.com/seanmonstar
[Hyper]: https://github.com/hyperium/hyper
