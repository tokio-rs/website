---
title: "I/O Overview"
weight : 2010
menu:
  docs:
    parent: io
---

Rust [`std::io`] module provides traits that synchronously access resources like
files and sockets.  These `Read` and `Write` traits are implemented in other
modules including [`std::fs`] and `std::net`.

The [`tokio`] crate comes with a variation on those types, [`AsyncRead`] and
[`AsyncWrite`].  The primary difference between [`AsyncRead`] and `std::io::Read`
is the [`futures::Async`] return values.  The implementation returns an `Error`,
`NotReady`, or `Ready` value.

## Non Blocking

The nature of a polling data reader/writer allows for other tasks to operate
before data reaches the socket or disk queue.  Synchronous operations evaluate
in a guaranteed sequential manner, and require commands to complete before the
next operation executes.

Consider this `std::net` implementation from the [`std::net` examples]

```rust,no_run
# #![allow(unused)]
# use std::io;
use std::net::{TcpListener, TcpStream};

# fn handle_client(stream: TcpStream) {
#     // ...
# }
#
fn main() -> io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8000")?;
#
#     // accept connections and process them serially
    for stream in listener.incoming() {
        handle_client(stream?);
    }
#    Ok(())
}
```

This single-threaded process will evaluate through calling `.incoming()` on
the `TcpListener` and will continue to run until receiving a KILL signal from
the operating system or until enough data is received on the TCP port to flush
the buffer, and reevaluating `.incoming()`.

`Tokio` I/O, rather than pausing execution, uses a `Futures` based syntax to
allow an event loop to respond to I/O rather than wait for it.  That event loop
is [`Tokio::reactor`] which receives events from [`mio`].

[`mio::net`] implements networking primitives that allow polling events.
[`mio::unix`] implement UNIX inter-process communication channels with polling.

## Included with Tokio

Tokio provides the high level interfaces to asynchronous IO for

  * [`TCP sockets`]
  * [`UDP sockets`]
  * [`Unix sockets`]


[`AsyncRead`]: {{< api-url "tokio" >}}/io/trait.AsyncRead.html
[`AsyncWrite`]: {{< api-url "tokio" >}}/io/trait.AsyncWrite.html
[`futures::Async`]: {{< api-url "futures" >}}/enum.Async.html
[`mio`]: {{< api-url "mio" >}}
[`mio::net`]: {{< api-url "mio" >}}/net/index.html
[`mio::unix`]: {{< api-url "mio" >}}/unix/index.html
[`std::fs`]: https://doc.rust-lang.org/std/fs/struct.File.html#implementations
[`std::io`]: https://doc.rust-lang.org/std/io/#read-and-write
[`std::net` examples]: https://doc.rust-lang.org/std/net/struct.TcpListener.html#examples
[`TCP sockets`]: {{< api-url "tokio" >}}/net/tcp/index.html
[`tokio`]: {{< api-url "tokio" >}}
[`Tokio::reactor`]: {{< api-url "tokio-reactor" >}}
[`UDP sockets`]: {{< api-url "tokio" >}}/net/udp/index.html
[`Unix sockets`]: {{< api-url "tokio" >}}/net/unix/index.html
