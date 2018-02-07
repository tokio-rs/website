+++
title = "Streaming protocols"
description = "An introduction to implementing a server for a streaming protocol"
+++

All of the previous guides used protocols that where requests and responses were
comprised by a single message frame. In other words, the entire request and
response data had to be buffered before parsing the value, in turn forcing the
application to wait for all the data to be received before starting to
processing the request.

Sometimes it is possible to begin processing the request before all data has
been received. For example, in HTTP, the application can start processing a
request once the head is received but before the body has been received. The
body of an HTTP request may be large, so it is useful for the application to be
able to stream in the body in chunks as it is received.

## [Overview](#overview) {#overview}

Just like in the [echo server]({{< relref "simple-server.md" >}}) guide,
implementing a client or server for a multiplexed protocol is done in three
parts:

- A **transport**, which manages serialization of Rust request and response
  types to the underlying socket. In this guide, we will implement this using
  the `framed` helper.

- A **protocol specification**, which puts together a codec and some basic
  information about the protocol.

- A **service**, which says how to produce a response given a request. A
  service is basically an asynchronous function.

Each part can vary independently, so once you've implemented a protocol
(like HTTP), you can pair it with a number of different services.

This guide specifically covers implementing a **pipelined** streaming protocol.
Implementing a multiplexed streaming protocol is similar and just requires using
the equivalent traits and types from the [`multiplex`] module.

[`multiplex`]: https://tokio-rs.github.io/tokio-proto/tokio_proto/streaming/multiplex/index.html

A full implementation can be found in the
[tokio-line](https://github.com/tokio-rs/tokio-line/blob/master/streaming/src/lib.rs)
repository. Let's see how it's done.

## [Step 1: Implement a transport](#implement-transport) {#implement-transport}

In Tokio, a [transport]({{< relref "architecture.md#framing" >}}) is any type
implementing [`Stream`]({{< api-url "futures" >}}/stream/trait.Stream.html)` +
`[`Sink`]({{< api-url "futures" >}}/sink/trait.Sink.html) where the yielded
items are frames.

We'll implement the same line-based protocol as in the [echo
server]({{< relref "simple-server.md" >}}) guide, but this time, we will make
it streaming. The protocol being implemented is a stream of frames, where each
frame is a UTF-8 encoded string terminated by a `\n` character. If an empty line
is received, then the line will be streamed in chunks. All following frames are
chunks of the line until another empty line is reached, which represents the
termination of the streaming line.

For our transport to be compatible with tokio-proto's streaming support, the
transport's frame type must be an instance of [`pipeline::Frame`]:

[`pipeline::Frame`]: https://tokio-rs.github.io/tokio-proto/tokio_proto/streaming/pipeline/enum.Frame.html

```rust,ignore
pub enum Frame<T, B, E> {
    Message {
        message: T,
        body: bool,
    },
    Body {
        chunk: Option<B>,
    },
    Error {
        error: E,
    },
}
```

Here, `T` represents the request or response head type and `B` represents the
type of each stream chunk. `E` is not used as part of this guide, but it
represents the type of an error frame. We will just set it to `io::Error`.

By having our `Decoder` yield frames of this type, `tokio-proto` is able to
dispatch the streaming body frames appropriately.

Again, we will use `Encoder`, `Decoder` and the `AsyncRead::framed` helper to
help us go from a `TcpStream` to a `Stream + Sink` for our frame type. Unlike
previous examples, our codec will retain some state for parsing (which is
typical for streaming protocols):

```rust
# extern crate bytes;
# extern crate tokio_io;
# extern crate tokio_proto;
#
# use std::io;
# use std::str;
#
# use bytes::{BytesMut, IntoBuf, Buf, BufMut};
# use tokio_io::codec::{Encoder, Decoder};
# use tokio_proto::streaming::pipeline::Frame;
#
pub struct LineCodec {
    decoding_head: bool,
}

impl Decoder for LineCodec {
    type Item = Frame<String, String, io::Error>;
    type Error = io::Error;

    fn decode(&mut self, buf: &mut BytesMut)
        -> Result<Option<Self::Item>, io::Error>
    {
        // Find the position of the next newline character and split off the
        // line if we find it.
        let line = match buf.iter().position(|b| *b == b'\n') {
            Some(n) => buf.split_to(n),
            None => return Ok(None),
        };

        // Also remove the '\n'
        buf.split_to(1);

        // Turn this data into a string and return it in a Frame
        let s = try!(str::from_utf8(&line).map_err(|e| {
            io::Error::new(io::ErrorKind::Other, e)
        }));

        // Got an empty line, which means that the state
        // should be toggled.
        if s == "" {
            let decoding_head = self.decoding_head;
            // Toggle the state
            self.decoding_head = !decoding_head;

            if decoding_head {
                Ok(Some(Frame::Message {
                    // The message head is an empty line
                    message: s.to_string(),
                    // We will be streaming a body next
                    body: true,
                }))
            } else {
                // The streaming body termination frame,
                // is represented as `None`.
                Ok(Some(Frame::Body {
                    chunk: None
                }))
            }
        } else {
            if self.decoding_head {
                // This is a "oneshot" message with no
                // streaming body
                Ok(Some(Frame::Message {
                    message: s.to_string(),
                    body: false,
                }))
            } else {
                // Streaming body line chunk
                Ok(Some(Frame::Body {
                    chunk: Some(s.to_string()),
                }))
            }
        }
    }
}

impl Encoder for LineCodec {
    type Item = Frame<String, String, io::Error>;
    type Error = io::Error;

    fn encode(&mut self, msg: Self::Item, buf: &mut BytesMut)
        -> io::Result<()>
    {
        match msg {
            Frame::Message { message, body } => {
                // Our protocol dictates that a message head that
                // includes a streaming body is an empty string.
                assert!(message.is_empty() == body);

                buf.extend(message.as_bytes());
            }
            Frame::Body { chunk } => {
                if let Some(chunk) = chunk {
                    buf.extend(chunk.as_bytes());
                }
            }
            Frame::Error { error } => {
                // Our protocol does not support error frames, so
                // this results in a connection level error, which
                // will terminate the socket.
                return Err(error)
            }
        }

        // Push the new line
        buf.extend(b"\n");

        Ok(())
    }
}
#
# fn main() {}
```

The implementation is similar in spirit to the codec we implemented in the
[echo server]({{< relref "simple-server.md" >}}) example. The main difference
is that we are returning `pipeline::Frame` values and we are differentiating
between the message head and a body chunk.

## [Step 2: Specify the protocol](#specify-protocol) {#specify-protocol}

The next step is to define the protocol details:

```rust
# extern crate tokio_proto;
# extern crate tokio_io;
# extern crate bytes;
#
# use std::io;
#
# use bytes::BytesMut;
# use tokio_io::{AsyncRead, AsyncWrite};
# use tokio_io::codec::{Encoder, Decoder, Framed};
# use tokio_proto::streaming::pipeline::{Frame, ServerProto};
#
# pub struct LineCodec {
#     decoding_head: bool,
# }
#
# impl Decoder for LineCodec {
#     type Item = Frame<String, String, io::Error>;
#     type Error = io::Error;
#
#     fn decode(&mut self, buf: &mut BytesMut) -> Result<Option<Self::Item>, io::Error> {
#         unimplemented!();
#     }
# }
#
# impl Encoder for LineCodec {
#     type Item = Frame<String, String, io::Error>;
#     type Error = io::Error;
#
#     fn encode(&mut self, msg: Self::Item, buf: &mut BytesMut) -> io::Result<()> {
#         unimplemented!();
#     }
# }
struct LineProto;

impl<T: AsyncRead + AsyncWrite + 'static> ServerProto<T> for LineProto {
    type Request = String;
    type RequestBody = String;
    type Response = String;
    type ResponseBody = String;
    type Error = io::Error;

    // `Framed<T, LineCodec>` is the return value
    // of `io.framed(LineCodec)`
    type Transport = Framed<T, LineCodec>;
    type BindTransport = Result<Self::Transport, io::Error>;

    fn bind_transport(&self, io: T) -> Self::BindTransport {
        // Initialize the codec to be parsing message heads
        let codec = LineCodec {
            decoding_head: true,
        };

        Ok(io.framed(codec))
    }
}
#
# fn main() {}
```

There are two additional associated types compared to the non-streaming version
of `ServerProto`: `RequestBody` and `ResponseBody`. This is the type of the
streaming body chunks, and they can differ from the `Request` and `Response`
types. So, for HTTP, the `Request` type may be `HttpRequestHead` and the
`RequestBody` type could be set to `Vec<u8>` to represent streaming in the
request body as a sequence of bytes. Here, we use `String` for both directions.

## [Step 3: Implement a service](#implement-service) {#implement-service}

The `Request` and `Response` types for a streaming protocol `Service` is
required to be [`tokio_proto::streaming::Message`]:

[`tokio_proto::streaming::Message`]: https://tokio-rs.github.io/tokio-proto/tokio_proto/streaming/enum.Message.html

```rust
pub enum Message<T, B> {
    WithoutBody(T),
    WithBody(T, B),
}
```

Here `T` will be the message head and `B` will be a [`Stream`]({{< api-url
"futures" >}}/stream/trait.Stream.html) of the body chunk type. `B` is usually
set to [`Body`], but this is not a requirement.

[`Body`]: https://tokio-rs.github.io/tokio-proto/tokio_proto/streaming/struct.Body.html

This step is similar to the
[echo server]({{< relref "simple-server.md#implement-service" >}}), except for
the change in types for the `Service`, which allows working with body streams:

```rust,no_run
# extern crate futures;
# extern crate tokio_io;
# extern crate tokio_proto;
# extern crate tokio_service;
# extern crate bytes;
#
# use futures::{future, Future, Stream};
# use tokio_service::Service;
#
# use std::io;
#
# use tokio_io::{AsyncRead, AsyncWrite};
# use tokio_io::codec::{Framed, Encoder, Decoder};
# use tokio_proto::TcpServer;
# use tokio_proto::streaming::{Message, Body};
# use tokio_proto::streaming::pipeline::{Frame, ServerProto};
# use bytes::{BytesMut};
#
# pub struct LineCodec {
#     decoding_head: bool,
# }
#
# impl Decoder for LineCodec {
#     type Item = Frame<String, String, io::Error>;
#     type Error = io::Error;
#
#     fn decode(&mut self, buf: &mut BytesMut) -> Result<Option<Self::Item>, io::Error> {
#         unimplemented!();
#     }
# }
# impl Encoder for LineCodec {
#     type Item = Frame<String, String, io::Error>;
#     type Error = io::Error;
#
#     fn encode(&mut self, msg: Self::Item, buf: &mut BytesMut) -> io::Result<()> {
#         unimplemented!();
#     }
# }
# struct LineProto;
#
# impl<T: AsyncRead + AsyncWrite + 'static> ServerProto<T> for LineProto {
#     type Request = String;
#     type RequestBody = String;
#     type Response = String;
#     type ResponseBody = String;
#     type Error = io::Error;
#
#     type Transport = Framed<T, LineCodec>;
#     type BindTransport = Result<Self::Transport, io::Error>;
#
#     fn bind_transport(&self, io: T) -> Self::BindTransport {
#         unimplemented!();
#     }
# }

struct PrintStdout;

impl Service for PrintStdout {
    type Request = Message<String, Body<String, io::Error>>;
    type Response = Message<String, Body<String, io::Error>>;
    type Error = io::Error;
    type Future = Box<Future<Item = Self::Response,
                            Error = Self::Error>>;

    fn call(&self, req: Self::Request) -> Self::Future {
        let resp = Message::WithoutBody("Ok".to_string());

        match req {
            Message::WithoutBody(line) => {
                println!("{}", line);
                Box::new(future::done(Ok(resp)))
            }
            Message::WithBody(_, body) => {
                let resp = body
                    .for_each(|line| {
                        println!(" + {}", line);
                        Ok(())
                    })
                    .map(move |_| resp);

                Box::new(resp) as Self::Future
            }
        }
    }
}

fn main() {
    // Specify the localhost address
    let addr = "0.0.0.0:12345".parse().unwrap();

    // The builder requires a protocol and an address
    let server = TcpServer::new(LineProto, addr);

    // We provide a way to *instantiate* the service for each new
    // connection; here, we just immediately return a new instance.
    server.serve(|| Ok(PrintStdout));
}
```

You can see that the service is able to stream in the response body chunks.

In this example, we exposed the `Message` and `Body` types provided by
`tokio-proto`. In practice, you will probably want to keep those types
encapsulated in your library and provide your own request, response, and body
stream types. You can see how this is done in the
[full example](https://github.com/tokio-rs/tokio-line/blob/master/streaming/src/lib.rs),
specifically the `Line`, `LineStream`, `ServerTypeMap`, and `ClientTypeMap`
types.
