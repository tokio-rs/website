+++
title = "Multiplexed protocols"
description = ""
menu = "going_deeper"
weight = 102
+++

Multiplexing is a method by which many concurrent requests can be issued over a
single socket such that responses may be received in a different order than the
issued requests. This allows the server to begin processing requests as soon as
they are received and to respond to the client as soon as the request is
processed. Generally, multiplexed protocols will make better usage of available
resources like TCP sockets.

Since responses arrive out of order, a **request ID** is used to match
reesponses with their associated requests. When the client issues a request, the
request will be paired with an identifier. The server processes the request, and
sends a response to the client paired with the same request identifier. This
allows the client to receive the response and pair it with a request that it
issued.

{{< figure src="/img/diagrams/multiplexing.png"
caption="Flow of multiplexed requests and responses" >}}

Tokio makes implementing multiplexed clients and servers easy. This
guide will show how.

## [Overview](#overview) {#overview}

Just like in the [simple server](TODO) guide, implementing a client or server
for a multiplexed protocol is done in three parts:

- A **transport**, which manages serialization of Rust request and response
  types to the underlying socket. In this guide, we will implement this using
  the `Codec` helper.

- A **protocol specification**, which puts together a codec and some basic
  information about the protocol.

- A **service**, which says how to produce a response given a request. A
  service is basically an asynchronous function.

Each part can vary independently, so once you've implemented a protocol
(like HTTP), you can pair it with a number different services.

This guide specifically covers implementing a **simple** multiplexed protocol.
The [next section](TODO) will go over how to implement a streaming protocol.

A full implementation can be found in the
[tokio-line](https://github.com/tokio-rs/tokio-line/blob/master/multiplexed/src/lib.rs)
repository. Let's see how it's done.

## [Step 1: Implement a transport](#implement-transport) {#implement-transport}

In Tokio, a [transport](/docs/going-deeper/architecture/#framing) is any type
implementing [`Stream`]({{< api-url "futures" >}}/stream/trait.Stream.html)` +
`[`Sink`]({{< api-url "futures" >}}/sink/trait.Sink.html) where the yielded
items are frames.

We'll implement the same line-based protocol as in the [simple server](TODO)
guide, but this time, we will make it multiplexed. The protocol being
implemented is a stream of frames, where each frame is:

* 4 byte header representing the numeric request ID in network byte order
* Frame payload, a UTF-8 encoded string of arbitrary length, terminated with a
  `\n` character.

**Note** that the lines themselves will not support containing *escaped* new
line characters.

For our transport to be compatible with tokio-proto's multiplexer, the frame
must be structured as such:

```rust,ignore
use tokio_proto::multiplex::RequestId;

type MyMultiplexedFrame<T> = (RequestId, T);
```

Where `T` represents the request or response type used for the `Service`.
tokio-proto will use the `RequestId` in the frame to match oustanding requests
with responses.

Again, we will use `Codec` and the `Io::framed` helper to help us go from a
`TcpStream` to a `Stream + Sink` for our frame type.

This is what our `Codec` implementation looks like:

```rust
# extern crate tokio_core;
# extern crate tokio_proto;
# extern crate byteorder;
#
# use std::io;
# use std::str;
#
# use tokio_core::io::{EasyBuf, Codec};
# use tokio_proto::multiplex::RequestId;
# use byteorder::{BigEndian, ByteOrder};
#
struct LineCodec;

impl Codec for LineCodec {
    type In = (RequestId, String);
    type Out = (RequestId, String);

    fn decode(&mut self, buf: &mut EasyBuf) -> Result<Option<(RequestId, String)>, io::Error> {
        // At least 5 bytes are required for a frame: 4 byte head + one byte
        // '\n'
        if buf.len() < 5 {
            return Ok(None);
        }

        // Check to see if the frame contains a new line, skipping the first 4
        // bytes which is the request ID
        if let Some(n) = buf.as_ref()[4..].iter().position(|b| *b == b'\n') {
            // remove the serialized frame from the buffer.
            let line = buf.drain_to(n + 4);

            // Also remove the '\n'
            buf.drain_to(1);

            // Deserialize the request ID
            let request_id = BigEndian::read_u32(&line.as_ref()[0..4]);

            // Turn this data into a UTF string and return it in a Frame.
            return match str::from_utf8(&line.as_ref()[4..]) {
                Ok(s) => Ok(Some((request_id as RequestId, s.to_string()))),
                Err(_) => Err(io::Error::new(io::ErrorKind::Other, "invalid string")),
            }
        }

        Ok(None)
    }

    fn encode(&mut self, msg: (RequestId, String), buf: &mut Vec<u8>) -> io::Result<()> {
        let (request_id, msg) = msg;

        let mut encoded_request_id = [0; 4];
        BigEndian::write_u32(&mut encoded_request_id, request_id as u32);

        buf.extend_from_slice(&encoded_request_id);
        buf.extend_from_slice(msg.as_bytes());
        buf.push(b'\n');

        Ok(())
    }
}
#
# fn main() {}
```

It's almost exactly the same as the codec that we implemented in the [simple
server](/docs/getting-started/simple-server) example. The main difference is
that the codec encodes and decodes frames that include the `RequestId`.

## [Step 2: Specify the protocol](#specify-protocol) {#specify-protocol}

The next step is to define the protocol details.

```rust
use tokio_proto::multiplex::ServerProto;

struct LineProto;

impl<T: Io + 'static> ServerProto<T> for LineProto {
    type Request = String;
    type Response = String;
    type Error = io::Error;

    /// `Framed<T, LineCodec>` is the return value of `io.framed(LineCodec)`
    type Transport = Framed<T, LineCodec>;
    type BindTransport = Result<Self::Transport, io::Error>;

    fn bind_transport(&self, io: T) -> Self::BindTransport {
        Ok(io.framed(LineCodec))
    }
}
```

This is exactly the same as the [simple
server](/docs/getting-started/simple-server#specify-protocol) example, except
that we are using `tokio_proto::multiplex::ServerProto`.

## [Step 3: Implement a service](#implement-service) {#implement-service}

This part is exactly the same as the [simple
server](/docs/getting-started/simple-server#implement-service)

```rust,ignore
struct Echo;

impl Service for Echo {
    type Request = String;
    type Response = String;
    type Error = io::Error;
    type Future = BoxFuture<Self::Response, Self::Error>;

    fn call(&mut self, req: Self::Request) -> Self::Future {
        future::ok(req).boxed()
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
