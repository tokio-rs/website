+++
title = "I/O with Tokio"
description = ""
menu = "getting_started"
weight = 150
+++

The [`tokio`] crate comes with TCP and UDP networking types. Unlike the types in
`std`, Tokio's networking types are based on the poll model and will notify the
task executors when their readiness states change (data is received and write
buffers are flushed). In the [`tokio::net`] module you'll find types like
[`TcpListener`], [`TcpStream`], and [`UdpSocket`].

All of these types provide both a future API as well as a poll
API.

The Tokio net types are powered by a [Mio] based reactor that, by default, is
started up lazily on a background thread. See [reactor] documentation for more
details.

## [Using the Future API](#future-api) {#future-api}

We've already seen some of this earlier in the guide with the [`incoming`]
function as well as the helpers found in [`tokio_io::io`].

These helpers include:

* [`incoming`]: A stream of inbound TCP connections.
* [`read_exact`]: Read exactly `n` bytes into a buffer.
* [`read_to_end`]: Read all bytes into a buffer.
* [`write_all`]: Write the entire contents of a buffer.
* [`copy`]: Copy bytes from one I/O handle to another.

A lot of these functions / helpers are generic over the [`AsyncRead`] and
[`AsyncWrite`] traits. These traits are similar to [`Read`] and [`Write`] from
[`std`], but are only for types that are "future aware", i.e. follow the
mandated properties:

* Calls to `read` or `write` are **nonblocking**, they never block the calling
  thread.
* If a call would otherwise block then an error is returned with the kind of
  `WouldBlock`. If this happens then the current future's task is scheduled to
  receive a notification (an unpark) when the I/O is ready again.

For example, here is how to accept connections, read 5 bytes from them, then
write the 5 bytes back to the socket:

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate tokio_io;
# extern crate futures;
#
# use tokio::executor::current_thread;
# use tokio::net::TcpListener;
# use tokio_io::io;
# use futures::{Future, Stream};
# fn main() {
#     let addr = "127.0.0.1:6142".parse().unwrap();
#     let listener = TcpListener::bind(&addr).unwrap();
let server = listener.incoming().for_each(|socket| {
    println!("accepted socket; addr={:?}", socket.peer_addr().unwrap());

    let buf = vec![0; 5];

    let connection = io::read_exact(socket, buf)
        .and_then(|(socket, buf)| {
            io::write_all(socket, buf)
        })
        .then(|_| Ok(())); // Just discard the socket and buffer

    // Spawn a new task that processes the socket:
    current_thread::spawn(connection);

    Ok(())
})
# ;
# }
```

[`incoming`]: #
[`read_exact`]: #
[`read_to_end`]: #
[`write_all`]: #
[`copy`]: #
[`AsyncRead`]: #
[`AsyncWrite`]: #
[`Read`]: #
[`Write`]: #
[`std`]: #
[`tokio_io::io`]: #

## [Using the Poll API](#poll-based) {#poll-based}

The Poll based API is to be used when implementing `Future` by hand and you need
to return `Async`. This is useful when you need to implement your own
combinators that handle custom logic.

For example, this is how the `read_exact` future could be implemented for a
`TcpStream`.

```rust
# #![deny(deprecated)]
# extern crate tokio;
# #[macro_use]
# extern crate tokio_io;
# extern crate futures;
#
# use tokio::net::TcpStream;
# use futures::prelude::*;
# use std::mem;
# use std::io::{self, Read};
pub struct ReadExact {
    state: State,
}

enum State {
    Reading {
        stream: TcpStream,
        buf: Vec<u8>,
        pos: usize,
    },
    Empty,
}

impl Future for ReadExact {
    type Item = (TcpStream, Vec<u8>);
    type Error = io::Error;

    fn poll(&mut self) -> Result<Async<Self::Item>, io::Error> {
        match self.state {
            State::Reading {
                ref mut stream,
                ref mut buf,
                ref mut pos
            } => {
                while *pos < buf.len() {
                    // try_nb! is a macro similar to `try_ready!` but
                    // for I/O types.
                    let n = try_nb!(stream.read(&mut buf[*pos..]));
                    *pos += n;
                    if n == 0 {
                        let err = io::Error::new(
                            io::ErrorKind::UnexpectedEof,
                            "early eof");

                        return Err(err)
                    }
                }
            }
            State::Empty => panic!("poll a ReadExact after it's done"),
        }

        match mem::replace(&mut self.state, State::Empty) {
            State::Reading { stream, buf, .. } => Ok((stream, buf).into()),
            State::Empty => panic!(),
        }
    }
}
# pub fn main() {}
```

## [Datagrams](#datagrams) {#datagrams}

Note that most of this discussion has been around I/O or byte *streams*, which
UDP importantly is not! To accommodate this, however, the [`UdpSocket`] type
also provides a number of methods for working with it conveniently:

* [`send_dgram`] allows you to express sending a datagram as a future, returning
  an error if the entire datagram couldn't be sent at once.
* [`recv_dgram`] expresses reading a datagram into a buffer, yielding both the
  buffer and the address it came from.

[`tokio`]: {{< api-url "tokio" >}}
[`tokio::net`]: {{< api-url "tokio" >}}/net/index.html
[`TcpListener`]: {{< api-url "tokio" >}}/net/struct.TcpListener.html
[`TcpStream`]: {{< api-url "tokio" >}}/net/struct.TcpStream.html
[`UdpSocket`]: {{< api-url "tokio" >}}/net/struct.UdpSocket.html
[`send_dgram`]: {{< api-url "tokio" >}}/net/struct.UdpSocket.html#method.send_dgram
[`recv_dgram`]: {{< api-url "tokio" >}}/net/struct.UdpSocket.html#method.recv_dgram
[`incoming`]: {{< api-url "tokio" >}}/net/struct.TcpListener.html#method.incoming
[`read_exact`]: {{< api-url "tokio-io" >}}/io/fn.read_exact.html
[`read_to_end`]: {{< api-url "tokio-io" >}}/io/fn.read_to_end.html
[`write_all`]: {{< api-url "tokio-io" >}}/io/fn.write_all.html
[`copy`]: {{< api-url "tokio-io" >}}/io/fn.copy.html
[`tokio_io::io`]: {{< api-url "tokio-io" >}}/io/index.html
[Mio]: https://docs.rs/mio/
[reactor]: {{< api-url "tokio" >}}/reactor/index.html
