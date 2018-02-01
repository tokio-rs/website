+++
title = "Multiplexed protocols"
description = "An introduction to implementing a server for a multiplexed protocol"
+++

A *multiplexed* socket connection is one that allows many concurrent requests to
be issued, with responses coming back in the order they are ready, rather than
in the order requested. Multiplexing allows a server to begin processing
requests as soon as they are received and to respond to the client as soon as
the request is processed. Generally, multiplexed protocols will make better
usage of available resources like TCP sockets.

Since responses arrive out of order, a **request ID** is used to match
responses with their associated requests. When the client issues a request, the
request will be paired with an identifier. The server processes the request, and
sends a response to the client paired with the same request identifier. This
allows the client to match the response with the request that it issued.

{{< figure src="/img/diagrams/multiplexing.png"
caption="Flow of multiplexed requests and responses" >}}

Tokio makes implementing multiplexed clients and servers easy. This
guide will show how.

## [Overview](#overview) {#overview}

Just as with the [echo server](../../getting-started/simple-server) guide,
implementing a client or server for a multiplexed protocol is done in three
parts:

- A **transport**, which manages serialization of Rust request and response
  types to the underlying socket. In this guide, we will implement this using
  the `framed` helper, just as before.

- A **protocol specification**, which puts together a codec and some basic
  information about the protocol.

- A **service**, which says how to produce a response given a request. A
  service is basically an asynchronous function.

Each part can vary independently, so once you've implemented a protocol
(like HTTP), you can pair it with a number of different services.

This guide specifically covers implementing a **simple** multiplexed protocol.
The [next section](../streaming) will show how to implement a streaming protocol.

The full implementation can be found in the
[tokio-line](https://github.com/tokio-rs/tokio-line/blob/master/multiplexed/src/lib.rs)
repository. Let's take it step by step.

## [Step 1: Implement a transport](#implement-transport) {#implement-transport}

In Tokio, a [transport]({{< relref "architecture.md#framing" >}}) is any type
implementing [`Stream`]({{< api-url "futures" >}}/stream/trait.Stream.html)` +
`[`Sink`]({{< api-url "futures" >}}/sink/trait.Sink.html) where the yielded
items are frames.

We'll implement the same line-based protocol as in the
[echo server](../../getting-started/simple-server) guide, but this time, we will
make it multiplexed. The protocol being implemented is a stream of frames, where
each frame is:

* 4 byte header representing the numeric request ID in network byte order
* Frame payload, a UTF-8 encoded string of arbitrary length, terminated with a
  `\n` character.

**Note** that the lines themselves will not support containing *escaped* new
line characters.

For our transport to be compatible with tokio-proto's multiplexer, the frame
must be structured as a pair of a request identifier and a payload:

```rust,ignore
use tokio_proto::multiplex::RequestId;

type MyMultiplexedFrame<T> = (RequestId, T);
```

The `T` here represents the request or response type used for the `Service`.
`tokio-proto` will use the `RequestId` in the frame to match outstanding
requests with responses.

We will use `Encoder`/`Decoder` traits and the `AsyncRead::framed` helper to
help us go from a `TcpStream` to a `Stream + Sink` for our frame type:

```rust
# extern crate tokio_core;
# extern crate tokio_proto;
# extern crate bytes;
# extern crate tokio_io;
#
# use std::io;
# use std::str;
#
# use tokio_proto::multiplex::RequestId;
# use bytes::{Buf, BigEndian, BytesMut, BufMut, IntoBuf};
# use tokio_io::codec::{Encoder, Decoder};
#
struct LineCodec;

impl Decoder for LineCodec {
    type Item = (RequestId, String);
    type Error = io::Error;

    fn decode(&mut self, buf: &mut BytesMut)
             -> io::Result<Option<(RequestId, String)>>
    {
        // At least 5 bytes are required for a frame: 4 byte
        // head + one byte '\n'
        if buf.len() < 5 {
            // We don't yet have a full message
            return Ok(None);
        }

        // Check to see if the frame contains a new line, skipping
        // the first 4 bytes which is the request ID
        let newline = buf[4..].iter().position(|b| *b == b'\n');
        if let Some(n) = newline {
            // remove the serialized frame from the buffer.
            let mut line = buf.split_to(n + 4);

            // Also remove the '\n'
            buf.split_to(1);

            // Deserialize the request ID
            let id = line.split_to(4).into_buf().get_u32::<BigEndian>();

            // Turn this data into a UTF string and return it in a Frame.
            return match str::from_utf8(&line[..]) {
                Ok(s) => Ok(Some((id as RequestId, s.to_string()))),
                Err(_) => Err(io::Error::new(io::ErrorKind::Other,
                                             "invalid string")),
            }
        }

        // No `\n` found, so we don't have a complete message
        Ok(None)
    }
}

impl Encoder for LineCodec {
    type Item = (RequestId, String);
    type Error = io::Error;

    fn encode(&mut self,
              msg: (RequestId, String),
              buf: &mut BytesMut) -> io::Result<()>
    {
        let (id, msg) = msg;

        buf.put_u32::<BigEndian>(id as u32);
        buf.put(msg.as_bytes());
        buf.put("\n");

        Ok(())
    }
}
#
# fn main() {}
```

It's almost exactly the same as the codec that we implemented in the [simple
server]({{< relref "simple-server.md" >}}) example. The main difference is
that the codec encodes and decodes frames that include the `RequestId`.

## [Step 2: Specify the protocol](#specify-protocol) {#specify-protocol}

The next step is to define the protocol details.

```rust,ignore
use tokio_proto::multiplex::ServerProto;

struct LineProto;

impl<T: AsyncRead + AsyncWrite + 'static> ServerProto<T> for LineProto {
    type Request = String;
    type Response = String;

    // `Framed<T, LineCodec>` is the return value
    // of `io.framed(LineCodec)`
    type Transport = Framed<T, LineCodec>;
    type BindTransport = Result<Self::Transport, io::Error>;

    fn bind_transport(&self, io: T) -> Self::BindTransport {
        Ok(io.framed(LineCodec))
    }
}
```

This is exactly the same as the [simple
server]({{< relref "simple-server.md#specify-protocol" >}}) example, except
that we are using `tokio_proto::multiplex::ServerProto`.

## [Step 3: Implement a service](#implement-service) {#implement-service}

This part is exactly the same as the [simple
server]({{< relref "simple-server.md#implement-service" >}})

```rust,ignore
struct Echo;

impl Service for Echo {
    type Request = String;
    type Response = String;
    type Error = io::Error;
    type Future = Box<Future<Item = Self::Response, Error =  Self::Error>>;

    fn call(&self, req: Self::Request) -> Self::Future {
        Box::new(future::ok(req))
    }
}

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

An interesting thing to note is that `RequestId` does not show up as part of the
`Service`'s request and response types. The `RequestId` is only needed for
tokio-proto to manage the internal state of keeping requests and responses
matched when operating on the transport.

Again, you can find the full working example
[here](https://github.com/tokio-rs/tokio-line/tree/master/multiplexed).
