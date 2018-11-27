---
title: "Getting asynchronous"
weight : 2030
menu:
  docs:
    parent: futures
---

Futures are all about managing asynchronicity. Implementing a future that
completes asynchonously requires correctly handling receiving `Async::NotReady`
from the inner future.

Let's start by implementing a future that establishes a TCP socket with a remote
peer and extracts the peer socket address, writing it to STDOUT.

```rust
# #![deny(deprecated)]
extern crate tokio;
#[macro_use]
extern crate futures;

use tokio::net::{TcpStream, tcp::ConnectFuture};
use futures::{Future, Async, Poll};

struct GetPeerAddr {
    connect: ConnectFuture,
}

impl Future for GetPeerAddr {
    type Item = ();
    type Error = ();

    fn poll(&mut self) -> Poll<Self::Item, Self::Error> {
        match self.connect.poll() {
            Ok(Async::Ready(socket)) => {
                println!("peer address = {}", socket.peer_addr().unwrap());
                Ok(Async::Ready(()))
            }
            Ok(Async::NotReady) => Ok(Async::NotReady),
            Err(e) => {
                println!("failed to connect: {}", e);
                Ok(Async::Ready(()))
            }
        }
    }
}

fn main() {
    let addr = "192.168.0.1:1234".parse().unwrap();
    let connect_future = TcpStream::connect(&addr);
    let get_peer_addr = GetPeerAddr {
        connect: connect_future,
    };

# if false {
    tokio::run(get_peer_addr);
# }
}
```

The implementation of `GetPeerAddr` is very similar to the `Display` future from
the previous page. The primary difference is, in this case,
`self.connect.poll()` will (probably) return `Async::NotReady` a number of times
before returning the connected socket. When this happens, our future returns
`NotReady`.

`GetPeerAddr` contains [`ConnectFuture`], a future that completes once a TCP
stream has been established. This future is returned by [`TcpStream::connect`].

When `GetPeerAddr` is passed to `tokio::run`, Tokio will repeatedly call `poll`
until `Ready` is returned. The exact mechanism by which this happens is
described in later chapters.

When implementing `Future`, `Async::NotReady` **must not** be returned **unless**
`Async::NotReady` was obtained when calling `poll` on an inner future. One way
to think about it is, when a future is polled, it must do as much work as it can
until it either completes or becomes blocked on an inner future.

# Chaining computations

Now, let's take the connect future and update it to write "hello world" once the
TCP socket has been established.

```rust
# #![deny(deprecated)]
extern crate tokio;
extern crate bytes;
#[macro_use]
extern crate futures;

use tokio::io::AsyncWrite;
use tokio::net::{TcpStream, tcp::ConnectFuture};
use bytes::{Bytes, Buf};
use futures::{Future, Async, Poll};
use std::io::{self, Cursor};

// HelloWorld has two states, namely waiting to connect to the socket
// and already connected to the socket
enum HelloWorld {
    Connecting(ConnectFuture),
    Connected(TcpStream, Cursor<Bytes>),
}

impl Future for HelloWorld {
    type Item = ();
    type Error = io::Error;

    fn poll(&mut self) -> Poll<(), io::Error> {
        use self::HelloWorld::*;

        loop {
            let socket = match *self {
                Connecting(ref mut f) => {
                    try_ready!(f.poll())
                }
                Connected(ref mut socket, ref mut data) => {
                    // Keep trying to write the buffer to the socket as long as the
                    // buffer has more bytes it available for consumption
                    while data.has_remaining() {
                        try_ready!(socket.write_buf(data));
                    }

                    return Ok(Async::Ready(()));
                }
            };

            let data = Cursor::new(Bytes::from_static(b"hello world"));
            *self = Connected(socket, data);
        }
    }
}

fn main() {
    let addr = "127.0.0.1:1234".parse().unwrap();
    let connect_future = TcpStream::connect(&addr);
    let hello_world = HelloWorld::Connecting(connect_future);
# let hello_world = futures::future::ok::<(), ()>(());

    // Run it
    tokio::run(hello_world)
}
```

It is very common to implement futures as an `enum` of the possible
states. This allows the future implementation to track its state
internally by transitioning between the enum's variants.

This future is represented as an enumeration of states:

1. Connecting
2. Writing "hello world" to the socket.

The future starts in the connecting state with an inner future of type
[`ConnectFuture`]. It repeatedly polls this future until the socket is returned.
The state is then transitioned to `Connected`.

From the `Connected` state, the future writes data to the socket. This is done
with the [`write_buf`] function. I/O functions are covered in more detail in the
[next section][io_section]. Briefly, [`write_buf`] is a non-blocking function to
write data to the socket. If the socket is not ready to accept the write,
`NotReady` is returned. If some data (but not necessarily all) was written,
`Ready(n)` is returned, where `n` is the number of written bytes. The cursor is
also advanced.

Once in the `Connected` state, the future must loop as long as there is data
left to write. Because [`write_buf`] is wrapped with `try_ready!()`, when
[`write_buf`] returns `NotReady`, our `poll` function returns with `NotReady`.

At some point in the future, our `poll` function is called again. Because it is
in the `Connected` state, it jumps directly to writing data.

**Note** the loops are important. Many future implementations contain loops.
These loops are necessary because `poll` cannot return until either all the data
is written to the socket, or an inner future ([`ConnectFuture`] or
[`write_buf`]) returns `NotReady`.

[`ConnectFuture`]: https://docs.rs/tokio/0.1/tokio/net/tcp/struct.ConnectFuture.html
[`write_buf`]: https://docs.rs/tokio/0.1/tokio/io/trait.AsyncWrite.html#method.write_buf
[`TcpStream::connect`]: https://docs.rs/tokio/0.1.12/tokio/net/struct.TcpStream.html#method.connect
[io_section]: {{< ref "/docs/io/overview.md" >}}
