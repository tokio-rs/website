+++
title = "Example: an echo server using proto"
description = ""
menu = "getting_started"
weight = 101
+++

To kick off our tour of Tokio, we'll build a simple line-based echo server using
`tokio-proto`:

```shell
$ cargo new --bin echo-proto
cd echo-proto
```

We'll need to add dependencies on the Tokio stack:

```toml
[dependencies]
bytes = "0.4"
futures = "0.1"
tokio-io = "0.1"
tokio-core = "0.1"
tokio-proto = "0.1"
tokio-service = "0.1"
```

and bring them into scope in `main.rs`:

```rust
extern crate bytes;
extern crate futures;
extern crate tokio_io;
extern crate tokio_proto;
extern crate tokio_service;
```

## [Overview](#overview) {#overview}

A server in `tokio-proto` is made up of three distinct parts:

- A **transport**, which manages serialization of Rust request and response
  types to the underlying socket. In this guide, we will implement this using
  the `framed` helper.

- A **protocol specification**, which puts together a codec and some basic
  information about the protocol (is it
[multiplexed]({{< relref "multiplex.md" >}})?
[streaming]({{< relref "streaming.md" >}})?).

- A **service**, which says how to produce a response given a request. A
  service is basically an asynchronous function. A service will contain 
  the stateful bits of a server like configuration information or a pool
  of database connections.

Each part can vary independently, so once you've implemented a protocol
(like HTTP), you can pair it with a number different services.

Let's see how it's done.

## [Step 1: Implement a codec](#implement-codec) {#implement-codec}

We'll start by implementing a codec for a simple line-based protocol,
where messages are arbitrary byte sequences delimited by `'\n'`. To do
this, we'll need a couple of tools from `tokio-io`:

```rust
# extern crate bytes;
# extern crate tokio_io;
use std::io;
use std::str;
use bytes::BytesMut;
use tokio_io::codec::{Encoder, Decoder};
# fn main() {}
```

In general, codecs may need local state, for example to record
information about incomplete decoding. We can get away without it,
though:

```rust
pub struct LineCodec;
```

Codecs in Tokio implement the [`Encoder`] and [`Decoder`] traits from
[tokio-io], which implements message encoding and decoding.  To start with,
we'll need to specify the message type:

[`Encoder`]: https://docs.rs/tokio-io/0.1/tokio_io/codec/trait.Encoder.html
[`Decoder`]: https://docs.rs/tokio-io/0.1/tokio_io/codec/trait.Decoder.html
[tokio-io]: https://crates.io/crates/tokio-io

```rust,ignore
impl Decoder for LineCodec {
    type Item = String;
    type Error = io::Error;

    // ...
}

impl Encoder for LineCodec {
    type Item = String;
    type Error = io::Error;

    // ...
}
```

We'll use `String` to represent lines, meaning that we'll require UTF-8 encoding
for this line protocol.

For our line-based protocol, decoding is straightforward:

```rust
# extern crate bytes;
# extern crate tokio_io;
#
# use std::io;
# use std::str;
# use bytes::BytesMut;
# use tokio_io::codec::{Encoder, Decoder};
#
# struct LineCodec;
#
impl Decoder for LineCodec {
    type Item = String;
    type Error = io::Error;

    fn decode(&mut self, buf: &mut BytesMut) -> io::Result<Option<String>> {
        if let Some(i) = buf.iter().position(|&b| b == b'\n') {
            // remove the serialized frame from the buffer.
            let line = buf.split_to(i);

            // Also remove the '\n'
            buf.split_to(1);

            // Turn this data into a UTF string and return it in a Frame.
            match str::from_utf8(&line) {
                Ok(s) => Ok(Some(s.to_string())),
                Err(_) => Err(io::Error::new(io::ErrorKind::Other,
                                             "invalid UTF-8")),
            }
        } else {
            Ok(None)
        }
    }
}
# fn main() {}
```

The [`BytesMut`] used here provides simple but efficient buffer management; you
can think of it like `Arc<[u8]>`, a reference-counted slice of bytes, with all
the details handled for you. Outgoing messages from the server use `Result` in
order to convey service errors on the Rust side.

[`BytesMut`]: https://docs.rs/bytes/0.4/bytes/struct.BytesMut.html

When [decoding], we are given an input [`BytesMut`] that contains a chunk of
unprocessed data, and we must try to extract the first complete message, if
there is one. If the buffer doesn't contain a complete message, we return
`None`, and the server will automatically fetch more data before trying to
decode again. The [`split_to`] method on [`BytesMut`] splits the buffer in two
at the given index, returning a new [`BytesMut`] instance corresponding to the
prefix ending at the index, and updating the existing [`BytesMut`] to contain
only the suffix. It's the typical way to remove one complete message from the
input buffer.

[decoding]: https://docs.rs/tokio-io/0.1/tokio_io/codec/trait.Decoder.html#tymethod.decode
[`split_to`]: https://docs.rs/bytes/0.4/bytes/struct.BytesMut.html#method.split_to

Encoding is even easier: you're given mutable access to a [`BytesMut`],
into which you serialize your output data. To keep things simple,
we won't provide support for error responses:

```rust
# extern crate bytes;
# extern crate tokio_io;
#
# use std::io;
# use std::str;
# use bytes::BytesMut;
# use tokio_io::codec::{Encoder, Decoder};
#
# struct LineCodec;
#
impl Encoder for LineCodec {
    type Item = String;
    type Error = io::Error;

    fn encode(&mut self, msg: String, buf: &mut BytesMut) -> io::Result<()> {
        buf.extend(msg.as_bytes());
        buf.extend(b"\n");
        Ok(())
    }
}
# fn main() {}
```

And that's it for our codec.

## [Step 2: Specify the protocol](#specify-protocol) {#specify-protocol}

Next, we turn the codec into a full-blown protocol. The `tokio-proto` crate is
equipped to deal with a variety of protocol styles, including
[multiplexed]({{< relref "multiplex.md" >}}) and
[streaming]({{< relref "streaming.md" >}}) protocols. For our line-based
protocol, though, we'll use the simplest style: a pipelined, non-streaming
protocol:

```rust
# extern crate tokio_proto;
use tokio_proto::pipeline::ServerProto;
# fn main() {}
```

As with codecs, protocols can carry state, typically used for configuration. We
don't need any configuration, so we'll make another unit struct:

```rust
pub struct LineProto;
```

Setting up a protocol requires just a bit of boilerplate, tying together our
chosen protocol style with the codec that we've built:

```rust
# extern crate tokio_proto;
# extern crate tokio_io;
# extern crate bytes;
#
# use std::io;
#
# use tokio_proto::pipeline::ServerProto;
use tokio_io::{AsyncRead, AsyncWrite};
use tokio_io::codec::Framed;
# use bytes::BytesMut;
# use tokio_io::codec::{Encoder, Decoder};
#
# struct LineCodec;
#
# impl Decoder for LineCodec {
#   type Item = String;
#   type Error = io::Error;
#
#   fn decode(&mut self, buf: &mut BytesMut) -> io::Result<Option<String>> {
#       if let Some(i) = buf.iter().position(|&b| b == b'\n') {
#           // remove the serialized frame from the buffer.
#           let line = buf.split_to(i);
#
#           // Also remove the '\n'
#           buf.split_to(1);
#
#           // Turn this data into a UTF string and return it in a Frame.
#           match std::str::from_utf8(&line) {
#               Ok(s) => Ok(Some(s.to_string())),
#               Err(_) => Err(io::Error::new(io::ErrorKind::Other,
#                                            "invalid UTF-8")),
#           }
#       } else {
#           Ok(None)
#       }
#   }
# }
#
# impl Encoder for LineCodec {
#   type Item = String;
#   type Error = io::Error;
#
#   fn encode(&mut self, msg: String, buf: &mut BytesMut) -> io::Result<()> {
#       buf.extend(msg.as_bytes());
#       buf.extend(b"\n");
#       Ok(())
#   }
# }
#
# struct LineProto;

impl<T: AsyncRead + AsyncWrite + 'static> ServerProto<T> for LineProto {
    /// For this protocol style, `Request` matches the `Item` type of the codec's `Decoder`
    type Request = String;

    /// For this protocol style, `Response` matches the `Item` type of the codec's `Encoder`
    type Response = String;

    /// A bit of boilerplate to hook in the codec:
    type Transport = Framed<T, LineCodec>;
    type BindTransport = Result<Self::Transport, io::Error>;
    fn bind_transport(&self, io: T) -> Self::BindTransport {
        Ok(io.framed(LineCodec))
    }
}
#
# fn main() {}
```

## [Step 3: Implement a service](#implement-service) {#implement-service}

At this point, we've built a generic line-based protocol. To actually *use* this
protocol, we need to pair it with a *service* that says how to respond to requests.
The `tokio-service` crate provides a `Service` trait for just this purpose:

```rust
# extern crate tokio_service;
use tokio_service::Service;
# fn main() {}
```

As with the other components we've built, in general a service may have data
associated with it. The service we want for this example just echos its input,
so no additional data is needed:

```rust
pub struct Echo;
```

At its core, a service is an *asynchronous (non-blocking) function* from
requests to responses.  We'll have more to say about asynchronous programming in
the next guide; the only thing to know right now is that Tokio uses *futures*
for asynchronous code, through the `Future` trait. You can think of a future as
an asynchronous version of `Result`. Let's bring the basics into scope:

```rust
# extern crate futures;
use futures::{future, Future, BoxFuture};
# fn main() {}
```

For our echo service, we don't need to do any I/O to produce a response for a
request. So we use `future::ok` to make a future that immediately returns a
value---in this case, returning the request immediately back as a successful
response. To keep things simple, we'll also box the future into a trait object,
which allows us to use the `BoxFuture` trait to define our service, no matter
what future we actually use inside---more on those tradeoffs later!

```rust
# extern crate tokio_service;
# extern crate futures;
#
# use std::io;
# use tokio_service::Service;
# use futures::future;
# use futures::{Future, BoxFuture};
#
# struct Echo;
#
impl Service for Echo {
    // These types must match the corresponding protocol types:
    type Request = String;
    type Response = String;

    // For non-streaming protocols, service errors are always io::Error
    type Error = io::Error;

    // The future for computing the response; box it for simplicity.
    type Future = BoxFuture<Self::Response, Self::Error>;

    // Produce a future for computing a response from a request.
    fn call(&self, req: Self::Request) -> Self::Future {
        // In this case, the response is immediate.
        future::ok(req).boxed()
    }
}
#
# fn main() {}
```

## [We're done---now configure and run!](#configure-and-run) {#configure-and-run}

With that, we have the ingredients necessary for a full-blown server: a general
protocol, and a particular service to provide on it. All that remains is to
actually configure and launch the server, which we'll do using the `TcpServer`
builder:

```rust,no_run
# extern crate tokio_proto;
# extern crate tokio_core;
# extern crate tokio_io;
# extern crate futures;
# extern crate tokio_service;
# extern crate bytes;
#
# use std::io;
#
# use futures::future;
# use futures::{Future, BoxFuture};
# use tokio_io::{AsyncRead, AsyncWrite};
# use tokio_io::codec::{Framed, Encoder, Decoder};
# use bytes::BytesMut;
use tokio_proto::TcpServer;
# use tokio_proto::pipeline::ServerProto;
# use tokio_service::Service;
#
# struct LineCodec;
#
# impl Encoder for LineCodec {
#   type Item = String;
#   type Error = io::Error;
#
#   fn encode(&mut self, msg: String, buf: &mut BytesMut) -> io::Result<()> {
#       buf.extend(msg.as_bytes());
#       buf.extend(b"\n");
#       Ok(())
#   }
# }
#
# impl Decoder for LineCodec {
#   type Item = String;
#   type Error = io::Error;
#
#   fn decode(&mut self, buf: &mut BytesMut) -> io::Result<Option<String>> {
#       if let Some(i) = buf.iter().position(|&b| b == b'\n') {
#           // remove the serialized frame from the buffer.
#           let line = buf.split_to(i);
#
#           // Also remove the '\n'
#           buf.split_to(1);
#
#           // Turn this data into a UTF string and return it in a Frame.
#           match std::str::from_utf8(&line) {
#               Ok(s) => Ok(Some(s.to_string())),
#               Err(_) => Err(io::Error::new(io::ErrorKind::Other,
#                                            "invalid UTF-8")),
#           }
#       } else {
#           Ok(None)
#       }
#   }
# }
#
# struct LineProto;
#
# impl<T: AsyncRead + AsyncWrite + 'static> ServerProto<T> for LineProto {
#     type Request = String;
#     type Response = String;
#     type Transport = Framed<T, LineCodec>;
#     type BindTransport = Result<Self::Transport, io::Error>;
#     fn bind_transport(&self, io: T) -> Self::BindTransport {
#         Ok(io.framed(LineCodec))
#     }
# }
#
# struct Echo;
#
# impl Service for Echo {
#     type Request = String;
#     type Response = String;
#     type Error = io::Error;
#     type Future = BoxFuture<Self::Response, Self::Error>;
#
#     fn call(&self, req: Self::Request) -> Self::Future {
#         future::ok(req).boxed()
#     }
# }

fn main() {
    // Specify the localhost address
    let addr = "0.0.0.0:12345".parse().unwrap();

    // The builder requires a protocol and an address
    let server = TcpServer::new(LineProto, addr);

    // We provide a way to *instantiate* the service for each new
    // connection; here, we just immediately return a new instance.
    server.serve(|| Ok(Echo));
}
```

You can run this code and connect locally to try it out:

```shell
~ $ telnet localhost 12345
Trying 127.0.0.1...
Connected to localhost.
Escape character is '^]'.
hello, world!
hello, world!
echo
echo
```

## [Pairing with another service](#pairing) {#pairing}

That was a fair amount of ceremony for a simple echo server. But most of what we
did---the protocol specification---is reusable. To prove it, let's build a
service that echos its input in reverse:

```rust
# extern crate tokio_service;
# extern crate futures;
#
# use std::io;
# use tokio_service::Service;
# use futures::future;
# use futures::{Future, BoxFuture};
#
struct EchoRev;

impl Service for EchoRev {
    type Request = String;
    type Response = String;
    type Error = io::Error;
    type Future = BoxFuture<Self::Response, Self::Error>;

    fn call(&self, req: Self::Request) -> Self::Future {
        let rev: String = req.chars()
            .rev()
            .collect();
        future::ok(rev).boxed()
    }
}
#
# fn main() {}
```

Not too shabby. And now, if we replace `Echo` with `EchoRev` in the line `server.serve(|| Ok(Echo));`, we'll see:

```shell
~ $ telnet localhost 12345
Trying 127.0.0.1...
Connected to localhost.
Escape character is '^]'.
hello, world!
!dlrow ,olleh
echo
ohce
```
