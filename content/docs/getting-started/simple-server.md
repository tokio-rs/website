+++
title = "Example: an echo server using proto"
description = ""
menu = "getting_started"
weight = 1
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
futures = "0.1"
tokio-core = "0.1"
tokio-service = "0.1"
tokio-proto = "0.1"
```

and bring them into scope in `main.rs`:

```rust
extern crate futures;
extern crate tokio_core;
extern crate tokio_proto;
extern crate tokio_service;
```

## [Overview](#overview) {#overview}

A server in `tokio-proto` is made up of three distinct parts:

- A **codec**, which manages serialization of Rust request and response
  types a protocol.

- A **protocol specification**, which puts together a codec and some basic
  information about the protocol (is it
[multiplexed](/docs/going-deeper/multiplex)?
[streaming](/docs/going-deeper/streaming)?).

- A **service**, which says how to produce a response given a request. A
  service is basically an asynchronous function.

Each part can vary independently, so once you've implemented a protocol
(like HTTP), you can pair it with a number different services.

Let's see how it's done.

## [Step 1: Implement a codec](#implement-codec) {#implement-codec}

We'll start by implementing a codec for a simple line-based protocol,
where messages are arbitrary byte sequences delimited by `'\n'`. To do
this, we'll need a couple of tools from `tokio-core`:

```rust
# extern crate tokio_core;
use std::io;
use tokio_core::io::{Codec, EasyBuf};
# fn main() {}
```

In general, codecs may need local state, for example to record
information about incomplete decoding. We can get away without it,
though:

```rust
pub struct LineCodec;
```

Codecs in Tokio implement the  [`Codec` trait]({{< api-url "core"
>}}/io/trait.Codec.html) trait, which implements message encoding and decoding.
To start with, we'll need to specify the message type. `In` gives the types of
incoming messages *after decoding*, while `Out` gives the type of outgoing
messages *prior to encoding*:

```rust,ignore
impl Codec for LineCodec {
    type In = EasyBuf;
    type Out = io::Result<EasyBuf>;
```

The [`EasyBuf` type]({{< api-url "core" >}}/io/struct.EasyBuf.html) used here
provides simple but efficient buffer management; you can think of it like
`Arc<[u8]>`, a reference-counted immutable slice of bytes, with all the details
handled for you. Outgoing messages from the server use `Result` in order to
convey service errors on the Rust side.

`EasyBuf` is in fact a [built-in part of decoding]({{< api-url "core"
>}}/io/trait.Codec.html#tymethod.decode): we are given an input `EasyBuf` that
contains a chunk of unprocessed data, and we must try to extract the first
complete message, if there is one. If the buffer doesn't contain a complete
message, we return `None`, and the server will automatically fetch more data
before trying to decode again.

For our line-based protocol, decoding is straightforward:

```rust
# extern crate tokio_core;
#
# use std::io;
# use tokio_core::io::{Codec, EasyBuf};
#
# struct LineCodec;
#
# impl Codec for LineCodec {
#   type In = EasyBuf;
#   type Out = io::Result<EasyBuf>;
#
fn decode(&mut self, buf: &mut EasyBuf) -> io::Result<Option<Self::In>> {
    if let Some(i) = buf.as_slice().iter().position(|&b| b == b'\n') {
        // remove the line, including the '\n', from the buffer
        let mut full_line = buf.drain_to(i + 1);

        // strip the `\n` from the returned buffer
        Ok(Some(full_line.drain_to(i)))
    } else {
        Ok(None)
    }
}
#
#   fn encode(&mut self, out: io::Result<EasyBuf>, buf: &mut Vec<u8>) -> io::Result<()> {
#       Ok(())
#   }
#
# }
# fn main() {}
```

The [`drain_to` method]({{< api-url "core"
>}}/io/struct.EasyBuf.html#method.drain_to) on `EasyBuf` splits the buffer in
two at the given index, returning a new `EasyBuf` instance corresponding to the
prefix ending at the index, and updating the existing `EasyBuf` to contain only
the suffix. It's the typical way to remove one complete message from the input
buffer.

Encoding is even easier: you're given mutable access to a `Vec<u8>`,
into which you serialize your output data. To keep things simple,
we won't provide support for error responses:

```rust
# extern crate tokio_core;
#
# use std::io;
# use tokio_core::io::{Codec, EasyBuf};
#
# struct LineCodec;
#
# impl Codec for LineCodec {
#   type In = EasyBuf;
#   type Out = io::Result<EasyBuf>;
#
#    fn decode(&mut self, buf: &mut EasyBuf) -> io::Result<Option<Self::In>> {
#        Ok(None)
#    }
#
fn encode(&mut self, item: io::Result<EasyBuf>, into: &mut Vec<u8>)
         -> io::Result<()>
{
    let item = item.expect("Errors are not supported by this protocol");
    into.extend(item.as_slice());
    into.push(b'\n');
    Ok(())
}
# }
# fn main() {}
```

And that's it for our codec.

## [Step 2: Specify the protocol](#specify-protocol) {#specify-protocol}

Next, we turn the codec into a full-blown protocol. The `tokio-proto` crate is
equipped to deal with a variety of protocol styles, including
[multiplexed](/docs/going-deeper/multiplexed) and
[streaming](/docs/going-deeper/streaming) protocols. For our line-based
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
# extern crate tokio_core;
#
# use std::io;
#
# use tokio_proto::pipeline::ServerProto;
use tokio_core::io::{Io, Framed};
# use tokio_core::io::{EasyBuf, Codec};
#
# struct LineCodec;
#
# impl Codec for LineCodec {
#   type In = EasyBuf;
#   type Out = EasyBuf;
#
#   fn decode(&mut self, buf: &mut EasyBuf) -> io::Result<Option<Self::In>> {
#       Ok(None)
#   }
#
#   fn encode(&mut self, out: EasyBuf, buf: &mut Vec<u8>) -> io::Result<()> {
#       Ok(())
#   }
# }
#
# struct LineProto;

impl<T: Io + 'static> ServerProto<T> for LineProto {
    /// For this protocol style, `Request` matches the codec `In` type
    type Request = EasyBuf;

    /// For this protocol style, `Response` matches the successful arm of
    /// the codec `Out` type
    type Response = EasyBuf;

    /// For this protocol style, `Error` matches the erroneous arm of the
    /// codec `Out` type.
    type Error = io::Error;

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
# extern crate tokio_core;
# extern crate futures;
#
# use std::io;
# use tokio_service::Service;
# use tokio_core::io::EasyBuf;
# use futures::future;
# use futures::{Future, BoxFuture};
#
# struct Echo;
#
impl Service for Echo {
    // These types must match the corresponding protocol types:
    type Request = EasyBuf;
    type Response = EasyBuf;
    type Error = io::Error;

    // The future for computing the response; box it for simplicity.
    type Future = BoxFuture<Self::Response, Self::Error>;

    // Produce a future for computing a response from a request.
    fn call(&mut self, req: Self::Request) -> Self::Future {
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
# extern crate futures;
# extern crate tokio_service;
#
# use std::io;
#
# use futures::future;
# use futures::{Future, BoxFuture};
# use tokio_core::io::{EasyBuf, Codec, Framed, Io};
use tokio_proto::TcpServer;
# use tokio_proto::pipeline::ServerProto;
# use tokio_service::Service;
#
# struct LineCodec;
#
# impl Codec for LineCodec {
#   type In = EasyBuf;
#   type Out = EasyBuf;
#
#   fn decode(&mut self, buf: &mut EasyBuf) -> io::Result<Option<Self::In>> {
#       Ok(None)
#   }
#
#   fn encode(&mut self, out: EasyBuf, buf: &mut Vec<u8>) -> io::Result<()> {
#       Ok(())
#   }
# }
#
# struct LineProto;
#
# impl<T: Io + 'static> ServerProto<T> for LineProto {
#     type Request = EasyBuf;
#     type Response = EasyBuf;
#     type Error = io::Error;
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
#     type Request = EasyBuf;
#     type Response = EasyBuf;
#     type Error = io::Error;
#     type Future = BoxFuture<Self::Response, Self::Error>;
#
#     fn call(&mut self, req: Self::Request) -> Self::Future {
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
# extern crate tokio_core;
# extern crate futures;
#
# use std::io;
# use tokio_service::Service;
# use tokio_core::io::EasyBuf;
# use futures::future;
# use futures::{Future, BoxFuture};
#
struct EchoRev;

impl Service for EchoRev {
    type Request = EasyBuf;
    type Response = EasyBuf;
    type Error = io::Error;
    type Future = BoxFuture<Self::Response, Self::Error>;

    fn call(&mut self, req: Self::Request) -> Self::Future {
        let rev: Vec<u8> = req.as_slice().iter()
            .rev()
            .cloned()
            .collect();
        let resp = EasyBuf::from(rev);
        future::ok(resp).boxed()
    }
}
#
# fn main() {}
```

Not too shabby. And now, if we serve `EchoRev` instead of `Echo`, we'll see:

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
