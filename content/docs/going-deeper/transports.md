+++
title = "Working with transports"
description = "How to implement, use, and augment transports in Tokio"
menu = "going_deeper"
weight = 107
+++

A transport in Tokio is a full duplex channel of frame values. The transport is
responsible for encoding and decoding these frame values from an underlying I/O
source, like a socket. It is represented by the [`Stream`]({{< api-url "futures"
>}}/stream/trait.Stream.html) + [`Sink`]({{< api-url "futures" >}}/sink/trait.Sink.html) traits and can
be used directly or passed to tokio-proto. The transport can also encapsulate
protocol specific logic as shown in the [augmenting](#augmenting-transport)
section.

## [Implementing a transport](#implementing) {#implementing}

The easiest way to implement a transport is to use the
[`Codec`](/docs/getting-started/core/#io-codecs) helper. If that isn't
sufficient, then it is also possible to implement `Stream` + `Sink` directly for
a custom type.

This is what a transport that encodes and decodes single byte numbers as `u32`
might look like:

```rust
# extern crate futures;
# extern crate tokio_core;
#
# use std::io::{self, Read, Write};
#
# use futures::{Sink, Stream, Poll, Async, AsyncSink, StartSend};
# use tokio_core::io::Io;
#
pub struct IntTransport<T> {
    io: T,
}

impl<T> Stream for IntTransport<T> where T: Io {
    type Item = u32;
    type Error = io::Error;

    fn poll(&mut self) -> Poll<Option<u32>, io::Error> {
        let mut buf = [0; 1];

        let n = match self.io.read(&mut buf) {
            Err(e) => {
                if e.kind() == io::ErrorKind::WouldBlock {
                    return Ok(Async::NotReady);
                } else {
                    return Err(e);
                }
            }
            Ok(0) => {
                return Ok(Async::Ready(None));
            }
            Ok(_) => {
                return Ok(Async::Ready(Some(buf[0] as u32)));
            }
        };
    }
}

impl<T> Sink for IntTransport<T> where T: Io {
    type SinkItem = u32;
    type SinkError = io::Error;

    fn start_send(&mut self, item: u32)
        -> StartSend<u32, io::Error>
    {
        let buf = [item as u8];

        match self.io.write(&buf) {
            Err(e) => {
                if e.kind() == io::ErrorKind::WouldBlock {
                    return Ok(AsyncSink::NotReady(item));
                } else {
                    return Err(e);
                }
            }
            Ok(n) => {
                assert_eq!(1, n);
                return Ok(AsyncSink::Ready);
            }
        }
    }

    fn poll_complete(&mut self) -> Poll<(), io::Error> {
        match self.io.flush() {
            Err(e) => {
                if e.kind() == io::ErrorKind::WouldBlock {
                    return Ok(Async::NotReady);
                } else {
                    return Err(e);
                }
            }
            Ok(()) => {
                return Ok(Async::Ready(()));
            }
        }
    }
}
#
# pub fn main() {}
```

## [Using a transport](#using) {#using}

If the protocol being represented is a stream-oriented protocol (i.e., does not
really have a simple request / response structure), then it may make sense to
operate directly on the transport instead of using [tokio-proto].

[tokio-proto]: https://github.com/tokio-rs/tokio-proto

For example, the [line-based
protocol](https://github.com/tokio-rs/tokio-line/blob/master/simple/src/lib.rs)
implemented as part of our [first server](/docs/getting-started/simple-server)
could also be used in a streaming fashion. Let's imagine that we have a server
that wishes to open up a connection to a remote host and stream log messages.
This use case does not really have a request / response structure, but we can
still reuse the `Codec` we implemented:

```rust,ignore
// Connect to a remote address
TcpStream::connect(&remote_addr, &handle)
    .and_then(|socket| {
        // Once the socket has been established, use the `framed` helper
        // to create a transport.
        let transport = socket.framed(LineCodec);

        // We're just going to send a few "log" messages to the remote
        let lines_to_send: Vec<Result<String, io::Error>> = vec![
            Ok("Hello world".to_string()),
            Ok("This is another message".to_string()),
            Ok("Not much else to say".to_string()),
        ];

        // Send all the messages to the remote. The strings will be
        // encoded by the `Codec`. `send_all` returns a future that
        // completes once everything has been sent.
        transport.send_all(stream::iter(lines_to_send))
    });
```

The full example can be found
[here](https://github.com/tokio-rs/tokio-line/blob/master/simple/examples/stream_client.rs).

If the transport represents a request / response oriented protocol, then it will
make more sense to use it with
[tokio-proto](https://github.com/tokio-rs/tokio-proto). The [simple
server](/docs/getting-started/simple-server),
[multiplexing](/docs/going-deeper/multiplex), and
[streaming](/docs/going-deeper/streaming) guides show how to do this.

### [Augmenting the transport](#augmenting-transport) {#augmenting-transport}

A transport can do more than just encoding and decoding frames. Transports are
able to handle arbitrary connection-specific logic. For example, let's add
ping-pong support to the line-based protocol described above. In this case, the
protocol specification states that whenever a `PING` line is received, the peer
should respond immediately with a `PONG` (and neither is treated as a normal
message).

This behavior isn't application-specific, and as such shouldn't be
exposed at the request / response layer. To handle this, we implement a
transport middleware that adds the ping-pong behavior:

```rust,ignore
struct PingPong<T> {
    // The upstream transport
    upstream: T,
}

/// Implement `Stream` for our transport ping / pong middleware
impl<T> Stream for PingPong<T>
    where T: Stream<Item = String, Error = io::Error>,
          T: Sink<SinkItem = String, SinkError = io::Error>,
{
    type Item = String;
    type Error = io::Error;

    fn poll(&mut self) -> Poll<Option<String>, io::Error> {
        loop {
            // Poll the upstream transport. `try_ready!` will bubble up
            // errors and Async::NotReady.
            match try_ready!(self.upstream.poll()) {
                Some(ref msg) if msg == "PING" => {
                    // Intercept PING messages and send back a PONG
                    let res = try!(self.start_send("PONG".to_string()));

                    // Ideally, the case of the sink not being ready
                    // should be handled. See the link to the full
                    // example below.
                    assert!(res.is_ready());

                    // Try flushing the pong, only bubble up errors
                    try!(self.poll_complete());
                }
                m => return Ok(Async::Ready(m)),
            }
        }
    }
}
```

Then, the line based transport from above can be decorated by `PingPong`
and used the same way as it would have been without the ping / pong
functionality:

```rust,ignore
let transport = PingPong {
    upstream: socket.framed(line::LineCodec),
};
```

[Full example](https://github.com/tokio-rs/tokio-line/blob/master/simple/examples/ping_pong.rs)
