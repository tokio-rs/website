+++
title = "Architecture overview"
description = "An overview of Tokio's components and how they fit together"
menu = "going_deeper"
weight = 90
+++

Most networking applications are structured in a layered fashion.

- **Byte streams** are at the lowest layer. They are usually provided by TCP or
  UDP sockets. At this layer, operations are made against byte arrays and
  usually done with buffers. Besides directly manipulating the socket, this is
  also where functionality like
  [TLS](https://en.wikipedia.org/wiki/Transport_Layer_Security) resides.

* **Framing** is taking a raw stream of bytes and breaking it up into meaningful
  units. For example, HTTP naturally has frames consisting of request headers,
  response headers, or body chunks. A line-based protocol consists of `String`
  frames that are delineated by new line tokens. At this point, instead of
  dealing with a stream of raw bytes, we are dealing with a stream of frame
  values. In Tokio, we sometimes refer to a full duplex stream of frames as a
  *transport*, which implements both the `Stream` and `Sink` traits.

* A **request / response exchange** generally is where application logic starts
  appearing. For a client, at this layer, a request is issued and a response for
  the request is returned. When the request is issued, it is turned into one or
  more frames and written to a transport. Then, at some point in the future, a
  response to the request will be read from the transport, and matched with the
  original request.

* At the **application** layer, the details of how requests and responses are
  mapped onto a transport doesn't matter. A single application may be receiving
  and issuing requests for many different protocols. An HTTP server application
  will be receiving HTTP requests, and then in turn, issuing database requests
  or other HTTP requests.

Each of these layers tend to be implemented in different libraries, and the end
application will pull in the protocol implementations and just interact with
them at the request / response exchange layer.

Tokio's abstractions map on to these different layers.

## [Byte streams](#byte-streams) {#byte-streams}

[tokio-core](http://github.com/tokio-rs/tokio-core) provides the lowest level
building blocks for writing asynchronous I/O code: an
[event loop](/docs/getting-started/reactor/) and the
[concrete I/O types](/docs/getting-started/core/#concrete-io), such as TCP and
UDP sockets.  These primitives work on the byte level much like the `std::io`
types, except the Tokio types are non-blocking. Other sections describe both
[high-level](/docs/getting-started/core) and [low-level](../core-low-level) APIs
for working with byte streams.

## [Framing](#framing) {#framing}

Framing is done with Tokio by first defining a frame type, usually an `enum`,
then implementing a transport as a
[`Stream + Sink`](/docs/getting-started/streams-and-sinks) that works with that
frame type. The transport handles encoding and decoding the frame values to
the raw stream of bytes. This can either be done [manually](TODO) or using a
helper like [`Codec`](/docs/getting-started/core/#io-codecs).

### [Using a transport](#using-transport) {#using-transport}

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
        // Once the socket has been established, use the `framed` helper to
        // create a transport.
        let transport = socket.framed(LineCodec);

        // We're just going to send a few "log" messages to the remote
        let lines_to_send: Vec<Result<String, io::Error>> = vec![
            Ok("Hello world".to_string()),
            Ok("This is another message".to_string()),
            Ok("Not much else to say".to_string()),
        ];

        // Send all the messages to the remote. The strings will be encoded by
        // the `Codec`. `send_all` returns a future that completes once
        // everything has been sent.
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
            // Poll the upstream transport. `try_ready!` will bubble up errors
            // and Async::NotReady.
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

## [Request / Response](#request-response) {#request-response}

The request / response exchange layer is handled by Tokio's [`Service`](TODO)
trait. The `Service` trait is a simplified interface making it easy to write
network applications in a modular and reusable way, decoupled from the
underlying protocol. It is one of Tokio's fundamental abstractions. It is a
similar abstraction to Finagle's `Service`, Ruby's Rack, or Java's servlet;
however, Tokio's `Service` trait is abstract over the underlying protocol.

There are generally two ways to map request / responses to a stream of frames:
[pipelining](TODO) or [multiplexing](TODO). [tokio-proto](TODO)'s goal is to
take a transport and handle the required logic to map that to an implementation
of `Service`.

A big advantage of having a standardized `Service` interface is that it is
possible to write reusable [middleware](TODO) components that add useful
functionality.

## [Application](#application) {#application}

Generally, all the previously listed layers will be implemented in libraries.
For example, an HTTP server implementation would implement an HTTP transport,
then use [tokio-proto](TODO) to map that to a `Service`. The `Service` is what
the HTTP library would expose.

An application would depend on many different libraries, providing various
protocol implementations exposed as services, and using the [futures](TODO)
library to hook everything together.
