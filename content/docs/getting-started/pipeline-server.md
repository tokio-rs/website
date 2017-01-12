+++
title = "Example: a simple pipelined server using core"
menu = "getting_started"
weight = 7
+++

Now that we've seen the basics of [high-level I/O using `tokio-core`](../core),
let's use it to write a simple pipelined server that uses the [`Service`] trait
to host an arbitrary service using a simple line-based protocol (much like we
saw in the [initial proto example](../simple-server)).

We'll re-use the codec from the [initial server example](../simple-server):

```rust,ignore
pub struct LineCodec;
impl Codec for LineCodec {
    type In = String;
    type Out = String;
    ...
}
```

Now we'll write a server that can host an arbitrary service over this protocol:

```rust,no_run
# extern crate tokio_core;
# extern crate tokio_service;
# extern crate futures;
#
# use std::io;
# use tokio_core::io::{Io, Codec, EasyBuf};
#
# pub struct LineCodec;
#
# impl Codec for LineCodec {
#   type In = String;
#   type Out = String;
#
#   fn decode(&mut self, buf: &mut EasyBuf) -> io::Result<Option<Self::In>> {
#       Ok(None)
#   }
#
#   fn encode(&mut self, out: String, buf: &mut Vec<u8>) -> io::Result<()> {
#       Ok(())
#   }
# }
#
use tokio_core::reactor::Core;
use tokio_core::net::TcpListener;
use tokio_service::{Service, NewService};
use futures::{future, Future, Stream, Sink};

fn serve<S>(s: S) -> io::Result<()>
    where S: NewService<Request = String,
                        Response = String,
                        Error = io::Error> + 'static
{
    let mut core = Core::new()?;
    let handle = core.handle();

    let address = "0.0.0.0:12345".parse().unwrap();
    let listener = TcpListener::bind(&address, &handle)?;

    let connections = listener.incoming();
    let server = connections.for_each(move |(socket, _peer_addr)| {
        let (writer, reader) = socket.framed(LineCodec).split();
        let mut service = s.new_service()?;

        let responses = reader.and_then(move |req| service.call(req));
        let server = writer.send_all(responses)
            .then(|_| Ok(()));
        handle.spawn(server);

        Ok(())
    });

    core.run(server)
}
#
# fn main() {}
```

The basic structure of the server should look familiar at this point; we've seen
it several times now. There are two main points of interest here.

[`Service`]: https://tokio-rs.github.io/tokio-service/tokio_service/trait.Service.html
[`NewService`]: https://tokio-rs.github.io/tokio-service/tokio_service/trait.NewService.html

First, the argument to the `serve` function. We use [`NewService`], a trait for
service *instantiation*. The idea is to create a new service instance for each
connection, which allows the service to track per-connection state. The trait
provides a single function, [`new_service`], which does the
instantiation. [`NewService`] is automatically implemented for closures that
produce services.

[`new_service`]: https://tokio-rs.github.io/tokio-service/tokio_service/trait.NewService.html#tymethod.new_service

More interesting is the body of the server, where we put `tokio-core`'s
high-level APIs into use. First, we use the [`Io::framed`] method to work with
the socket using our codec; what we get back is a *transport*---an object that
is both a `Stream` and a `Sink`. The [`Stream::split`] method then breaks this
object into separate stream and sink objects:

[`Io::framed`]: https://docs.rs/tokio-core/0.1/tokio_core/io/trait.Io.html#method.framed
[`Stream::split`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.split

```rust,ignore
let (writer, reader) = socket.framed(LineCodec).split();
```

Now we're ready to instantiate the service:

```rust,ignore
let mut service = s.new_service()?;
```

Once we have a service instance in hand, we can use it to process incoming
requests. Remember that `reader` is a stream of requests; we use
[`Stream::and_then`] to sequence the service after it ([`Service::call`] returns a future):

```rust,ignore
let responses = reader.and_then(move |req| service.call(req));
```

[`Stream::and_then`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.and_then
[`Service::call`]: https://tokio-rs.github.io/tokio-service/tokio_service/trait.Service.html#tymethod.call

Now we've produced a stream of responses. We write these back to the socket,
using `writer` to encode them into our protocol. We also use `then` to throw
away the final result, giving us a `server` future that's in the right shape to spawn:

```rust,ignore
let server = writer.send_all(responses).then(|_| Ok(()));
handle.spawn(server);
```

And that's it---we've built a general-purpose server for a line-based
protocol. By using the built-in framing and [`Stream::send_all`] method, we also
get a pretty efficient server: it will batch up handling multiple requests and
responses if they are available. The key is that [`Stream::send_all`] eager
pulls as many elements from the stream as it can, writing them all into the
sink, flushing only at the end.

[`Stream::and_then`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.send_all

To complete the example, let's build one final echo service and plug them together:

```rust,ignore
use futures::{BoxFuture, future}

struct EchoService;

impl Service for EchoService {
    type Request = String;
    type Response = String;
    type Error = io::Error;
    type Future = BoxFuture<String, io::Error>;
    fn call(&self, input: String) -> Self::Future {
        future::ok(input).boxed()
    }
}

fn main() {
    if let Err(e) = serve(|| Ok(EchoService)) {
        println!("Server failed with {}", e);
    }
}
```
