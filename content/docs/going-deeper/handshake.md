+++
title = "Connection handshake"
description = ""
menu = "going_deeper"
weight = 104
+++

Some protocols require some setup before they can start accepting requests. For
example, PostgreSQL requires a [start-up
message](https://www.postgresql.org/docs/9.3/static/protocol-flow.html#AEN99290),
Transport Layer Security requires a
[handshake](https://en.wikipedia.org/wiki/Transport_Layer_Security#TLS_handshake),
and so does [HTTP/2.0](http://httpwg.org/specs/rfc7540.html#starting). This
section will show how to model that using Tokio.

This guide will build off of the [simple line-based
protocol](/docs/getting-started/simple-server) we saw earlier. Let's look at the
protocol specification again:

```rust,ignore
use tokio_proto::pipeline::ServerProto;

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

The [`BindTransport`](TODO) associated type, returned from the `bind_transport`
function is an [`IntoFuture`](TODO). This means that all connection setup work
can be done before realizing the `BindTransport` future. So far, all of our
protocols didn't need anything, so we just used `Result`, but now, we're going
to change that.

## [Implementing the handshake](#implementing-handshake) {#implementing-handshake}

We're going to modify our line-based protocol. When a client connects to a
server, it has to send the following line: `You ready?`. Once the server is
ready to accept requests, it responds with: `Bring it!`. If the server wants to
reject the client for some reason, it responds with: `No! Go away!`. The client
is then expected to close the socket.

The server implementation of the handshake looks like this:

```rust,ignore
// Construct the line-based transport
let transport = io.framed(LineCodec);

// The handshake requires that the client sends `You ready?`, so wait to
// receive that line. If anything else is sent, error out the connection
transport.into_future()
    // If the transport errors out, we don't care about the transport
    // anymore, so just keep the error
    .map_err(|(e, _)| e)
    .and_then(|(line, transport)| {
        // A line has been received, check to see if it is the handshake
        match line {
            Some(ref msg) if msg == "You ready?" => {
                println!("SERVER: received client handshake");
                // Send back the acknowledgement
                Box::new(transport.send("Bring it!".to_string())) as Self::BindTransport
            }
            _ => {
                // The client sent an unexpected handshake, error out
                // the connection
                println!("SERVER: client handshake INVALID");
                let err = io::Error::new(io::ErrorKind::Other, "invalid handshake");
                Box::new(future::err(err)) as Self::BindTransport
            }
        }
    })

```

The [transport](/going-deeper/architecture#using-transport) returned by
`Io::framed` is a value implementing [`Stream`](TODO) + [`Sink`](TODO) over the
frame type. In our case, the frame type is `String`, so we can use the transport
directly in order to implement our handshake logic.

The above snippet returns a future that completes with the transport when the
handshake has been completed.

## [Updating the protocol](#updating-protocol) {#updating-protocol}

The next step is to update the `bind_transport` function in our protocol
specification. Instead of returning the transport directly, we will perform the
handshake shown above:

```rust,ignore
impl<T: Io + 'static> ServerProto<T> for ServerLineProto {
    type Request = String;
    type Response = String;
    type Error = io::Error;

    /// `Framed<T, LineCodec>` is the return value of `io.framed(LineCodec)`
    type Transport = Framed<T, line::LineCodec>;
    type BindTransport = Box<Future<Item = Self::Transport, Error = io::Error>>;

    fn bind_transport(&self, io: T) -> Self::BindTransport {
        // Construct the line-based transport
        let transport = io.framed(line::LineCodec);

        // The handshake requires that the client sends `You ready?`, so wait to
        // receive that line. If anything else is sent, error out the connection
        let handshake = transport.into_future()
            // If the transport errors out, we don't care about the transport
            // anymore, so just keep the error
            .map_err(|(e, _)| e)
            .and_then(|(line, transport)| {
                // A line has been received, check to see if it is the handshake
                match line {
                    Some(ref msg) if msg == "You ready?" => {
                        println!("SERVER: received client handshake");
                        // Send back the acknowledgement
                        Box::new(transport.send("Bring it!".to_string())) as Self::BindTransport
                    }
                    _ => {
                        // The client sent an unexpected handshake, error out
                        // the connection
                        println!("SERVER: client handshake INVALID");
                        let err = io::Error::new(io::ErrorKind::Other, "invalid handshake");
                        Box::new(future::err(err)) as Self::BindTransport
                    }
                }
            });

        Box::new(handshake)
    }
}
```

Then, if we use `TcpServer` to start a server with our `ServerLineProto`, the
handshake will be performed before requests start being processed.

The full working code for both the client and server can be found
[here](https://github.com/tokio-rs/tokio-line/blob/master/simple/examples/handshake.rs).
