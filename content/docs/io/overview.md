---
title: "I/O Overview"
weight : 2010
menu:
  docs:
    parent: io
---

Rust provides types, traits, and helpers for performing synchronous I/O
operations, such as working with TCP, UDP, and, reading from and writing to
files.

The [`tokio`] crate improves on those operations by providing non-blocking
versions.  Tokio provides the high level interfaces to asynchronous I/O for

* [TCP sockets]
* [UDP sockets]
* [Unix sockets]
* [File operations]

## Blocking vs Non-Blocking

Synchronous operations evaluate in a guaranteed sequential manner, and require
expressions to complete before the next operation executes.  This is the
default behavior in Rust.  

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
the buffer then reevaluates `.incoming()`.

Asynchronous I/O provides a method to register a task to execute when the
program receives data.   

`Tokio`, rather than pausing execution, uses a `Futures` based syntax allowing
tasks to respond to I/O events as they arrive rather than wait for them
Networking events are provided by [`mio`], a non-blocking I/O library backed by
the operating system's event queue.  Filesystem I/O is implemented in
[`Tokio::fs`].

A `tokio` equivalent to the `std::net` implementation above would register a
future on the `TcpListener` (provided by [tokio::net::tcp]).

[`mio`]: {{< api-url "mio" >}}
[`std::net` examples]: https://doc.rust-lang.org/std/net/struct.TcpListener.html#examples
[`tokio`]: {{< api-url "tokio" >}}
[`Tokio::fs`]: {{< api-url "tokio" >}}/fs/index.html
[cross platform]: {{< api-url "mio" >}}/#platforms
[File operations]: {{< api-url "tokio" >}}/fs/index.html
[TCP sockets]: {{< api-url "tokio" >}}/net/tcp/index.html
[UDP sockets]: {{< api-url "tokio" >}}/net/udp/index.html
[Unix sockets]: {{< api-url "tokio" >}}/net/unix/index.html
