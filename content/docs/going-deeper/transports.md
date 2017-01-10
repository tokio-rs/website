+++
title = "Working with transports"
description = "How to use and augment transports in Tokio"
menu = "going_deeper"
weight = 104
+++

If the protocol being represented is a stream-oriented protocol (i.e., does not
really have a simple request / response structure), then it may make sense to
operate directly on the transport instead of using [tokio-proto](TODO).

For example, the [line-based protocol](TODO) implemented as part of our [first
server](TODO) could also be used in a streaming fashion. Let's imagine that we
have a server that wishes to open up a connection to a remote host and stream
log messages. This use case does not really have a request / response structure,
but we can still reuse the `Codec` we implemented:

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
