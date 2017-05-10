+++
title = "Connection handshakes"
description = "How to handle initial steps in a protocol"
menu = "going_deeper_tokio"
weight = 304
aliases = [
  "/docs/going-deeper/handshake/"
]
+++

Some protocols require some setup before they can start accepting requests. For
example, PostgreSQL requires a [start-up
message](https://www.postgresql.org/docs/9.3/static/protocol-flow.html#AEN99290),
Transport Layer Security requires a
[handshake](https://en.wikipedia.org/wiki/Transport_Layer_Security#TLS_handshake),
and so does [HTTP/2.0](http://httpwg.org/specs/rfc7540.html#starting). This
section will show how to model that using Tokio.

This guide will build off of the [simple line-based
protocol]({{< relref "simple-server.md" >}}) we saw earlier. Let's look at the
protocol specification again:

```rust
# extern crate tokio_io;
# extern crate tokio_proto;
# extern crate bytes;

use tokio_io::{AsyncRead, AsyncWrite};
use tokio_io::codec::{Framed, Encoder, Decoder};
use tokio_proto::pipeline::ServerProto;
use std::io;

struct LineProto;
#
# use bytes::BytesMut;
# struct LineCodec;
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

impl<T: AsyncRead + AsyncWrite + 'static> ServerProto<T> for LineProto
{
    type Request = String;
    type Response = String;

    // `Framed<T, LineCodec>` is the return value of
    // `io.framed(LineCodec)`
    type Transport = Framed<T, LineCodec>;
    type BindTransport = Result<Self::Transport, io::Error>;

    fn bind_transport(&self, io: T) -> Self::BindTransport {
        Ok(io.framed(LineCodec))
    }
}
# pub fn main() {}
```

The [`BindTransport`] associated type, returned from the `bind_transport`
function is an [`IntoFuture`]. This means that all connection setup work
can be done before realizing the `BindTransport` future. So far, none of our
protocols needed any setup, so we just used `Result`. But now, we're going
to change that.

[`BindTransport`]: https://tokio-rs.github.io/tokio-proto/tokio_proto/pipeline/trait.ServerProto.html#associatedtype.BindTransport
[`IntoFuture`]: https://docs.rs/futures/0.1/futures/future/trait.IntoFuture.html

## [Implementing the handshake](#implementing-handshake) {#implementing-handshake}

We're going to modify our line-based protocol. When a client connects to a
server, it has to send the following line: `You ready?`. Once the server is
ready to accept requests, it responds with: `Bring it!`. If the server wants to
reject the client for some reason, it responds with: `No! Go away!`. The client
is then expected to close the socket.

The server implementation of the handshake looks like this:

```rust
# extern crate tokio_io;
# extern crate tokio_proto;
# extern crate bytes;
# extern crate futures;
#
# use tokio_io::{AsyncRead, AsyncWrite};
# use tokio_io::codec::{Framed, Encoder, Decoder};
# use tokio_proto::pipeline::ServerProto;
# use futures::{future, Stream, Future, Sink};
# use std::io;
#
# struct LineProto;
#
# use bytes::BytesMut;
# struct LineCodec;
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
# impl<T: AsyncRead + AsyncWrite + 'static> ServerProto<T> for LineProto {
#     type Request = String;
#     type Response = String;
#
#     // `Framed<T, LineCodec>` is the return value of
#     // `io.framed(LineCodec)`
#     type Transport = Framed<T, LineCodec>;
#     type BindTransport = Box<Future<Item = Self::Transport, Error = io::Error>>;
#
#     fn bind_transport(&self, io: T) -> Self::BindTransport {
#         // Construct the line-based transport
#         let transport = io.framed(LineCodec);
#
#         // The handshake requires that the client sends `You ready?`, so wait to
#         // receive that line. If anything else is sent, error out the connection
#         Box::new(
transport.into_future()
    // If the transport errors out, we don't care about the transport
    // anymore, so just keep the error
    .map_err(|(e, _)| e)
    .and_then(|(line, transport)| {
        // A line has been received, check to see if
        // it is the handshake
        match line {
            Some(ref msg) if msg == "You ready?" => {
                println!("SERVER: received client handshake");
                // Send back the acknowledgement
                Box::new(transport.send("Bring it!".to_string()))
#                     as Self::BindTransport
            }
            _ => {
                // The client sent an unexpected handshake, error out
                // the connection
                println!("SERVER: client handshake INVALID");
                let err = io::Error::new(io::ErrorKind::Other,
                                         "invalid handshake");
                Box::new(future::err(err))
# as Self::BindTransport
            }
        }
    })
# )
#     }
# }
# pub fn main() {}
```

The transport returned by `AsyncRead::framed` is a value implementing [`Stream`] +
[`Sink`] over the frame type. In our case, the frame type is `String`, so we can
use the transport directly in order to implement our handshake logic.

[`Stream`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html
[`Sink`]: https://docs.rs/futures/0.1/futures/sink/trait.Sink.html

The above snippet returns a future that completes with the transport when the
handshake has been completed.

## [Updating the protocol](#updating-protocol) {#updating-protocol}

The next step is to update the `bind_transport` function in our protocol
specification. Instead of returning the transport directly, we will perform the
handshake shown above. Here's the full code:

```rust
# extern crate tokio_io;
# extern crate tokio_proto;
# extern crate bytes;
# extern crate futures;
#
# use tokio_io::{AsyncRead, AsyncWrite};
# use tokio_io::codec::{Framed, Encoder, Decoder};
# use tokio_proto::pipeline::ServerProto;
# use futures::{future, Stream, Future, Sink};
# use std::io;
#
# struct LineProto;
#
# use bytes::BytesMut;
# struct LineCodec;
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
impl<T: AsyncRead + AsyncWrite + 'static> ServerProto<T> for LineProto
{
    type Request = String;
    type Response = String;

    // `Framed<T, LineCodec>` is the return value of
    // `io.framed(LineCodec)`
    type Transport = Framed<T, LineCodec>;
    type BindTransport = Box<Future<Item = Self::Transport,
                                   Error = io::Error>>;

    fn bind_transport(&self, io: T) -> Self::BindTransport {
        // Construct the line-based transport
        let transport = io.framed(LineCodec);

        // The handshake requires that the client sends `You ready?`,
        // so wait to receive that line. If anything else is sent,
        // error out the connection
        Box::new(transport.into_future()
            // If the transport errors out, we don't care about
            // the transport anymore, so just keep the error
            .map_err(|(e, _)| e)
            .and_then(|(line, transport)| {
                // A line has been received, check to see if it
                // is the handshake
                match line {
                    Some(ref msg) if msg == "You ready?" => {
                        println!("SERVER: received client handshake");
                        // Send back the acknowledgement
                        let ret = transport.send("Bring it!".into());
                        Box::new(ret) as Self::BindTransport
                    }
                    _ => {
                        // The client sent an unexpected handshake,
                        // error out the connection
                        println!("SERVER: client handshake INVALID");
                        let err = io::Error::new(io::ErrorKind::Other,
                                                 "invalid handshake");
                        let ret = future::err(err);
                        Box::new(ret) as Self::BindTransport
                    }
                }
            }))
    }
}
# pub fn main() {}
```

Then, if we use `TcpServer` to start a server with our `ServerLineProto`, the
handshake will be performed before requests start being processed.

The full working code for both the client and server can be found
[here](https://github.com/tokio-rs/tokio-line/blob/master/simple/examples/handshake.rs).
