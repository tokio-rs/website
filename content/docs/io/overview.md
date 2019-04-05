---
title: "I/O Overview"
weight : 3010
menu:
  docs:
    parent: io
---

The Rust standard library provides support for networking and I/O, such
as TCP connections, UDP sockets, reading from and writing to files, etc.
However, those operations are all synchronous, or _blocking_, meaning
that when you call them, the current thread may stop executing and go to
sleep until it is unblocked. For example, the `read` method in
[`std::io::Read`] will block until there is data to read. In the world
of futures, that behavior is unfortunate, since we would like to
continue executing other futures we may have while waiting for the I/O
to complete.

To enable this, Tokio provides _non-blocking_ versions of many standard
library I/O resources, such as [file operations] and [TCP], [UDP], and
[Unix] sockets. They return futures for long-running operations (like
accepting a new TCP connection), and implement non-blocking variants of
`std::io::Read` and `std::io::Write` called `AsyncRead` and
`AsyncWrite`.

Non-blocking reads and writes do not block if, for example, there is no
more data available. Instead, they return immediately with a
`WouldBlock` error, along with a guarantee (like `Future::poll`) that
they have arranged for the current task to be woken up when they can
later make progress, such as when a network packet arrives.

By using the non-blocking Tokio I/O types, a future that performs I/O
no longer blocks execution of other futures if the I/O they wish to
perform cannot be performed immediately. Instead, it simply returns
`NotReady`, and relies on a task notification to cause `poll` to be
called again, and which point its I/O should succeed without blocking.

Behind the scenes, Tokio uses [`mio`] and [`tokio-fs`] to keep track of
the status of the various I/O resources that different futures are
waiting for, and is notified by the operating system whenever the status
of any of them change.

## An example server

To get a sense of how this fits together, consider this [echo
server](https://tools.ietf.org/html/rfc862) implementation:

```rust,no_run
# extern crate tokio;
use tokio::prelude::*;
use tokio::net::TcpListener;

# fn main() {
// Set up a listening socket, just like in std::net
let addr = "127.0.0.1:12345".parse().unwrap();
let listener = TcpListener::bind(&addr)
    .expect("unable to bind TCP listener");

// Listen for incoming connections.
// This is similar to the iterator of incoming connections that
// .incoming() from std::net::TcpListener, produces, except that
// it is an asynchronous Stream of tokio::net::TcpStream instead
// of an Iterator of std::net::TcpStream.
let incoming = listener.incoming();

// Since this is a Stream, not an Iterator, we use the for_each
// combinator to specify what should happen each time a new
// connection becomes available.
let server = incoming
    .map_err(|e| eprintln!("accept failed = {:?}", e))
    .for_each(|socket| {
        // Each time we get a connection, this closure gets called.
        // We want to construct a Future that will read all the bytes
        // from the socket, and write them back on that same socket.
        //
        // If this were a TcpStream from the standard library, a read or
        // write here would block the current thread, and prevent new
        // connections from being accepted or handled. However, this
        // socket is a Tokio TcpStream, which implements non-blocking
        // I/O! So, if we read or write from this socket, and the
        // operation would block, the Future will just return NotReady
        // and then be polled again in the future.
        //
        // While we *could* write our own Future combinator that does an
        // (async) read followed by an (async) write, we'll instead use
        // tokio::io::copy, which already implements that. We split the
        // TcpStream into a read "half" and a write "half", and use the
        // copy combinator to produce a Future that asynchronously
        // copies all the data from the read half to the write half.
        let (reader, writer) = socket.split();
        let bytes_copied = tokio::io::copy(reader, writer);
        let handle_conn = bytes_copied.map(|amt| {
            println!("wrote {:?} bytes", amt)
        }).map_err(|err| {
            eprintln!("I/O error {:?}", err)
        });

        // handle_conn here is still a Future, so it hasn't actually
        // done any work yet. We *could* return it here; then for_each
        // would wait for it to complete before it accepts the next
        // connection. However, we want to be able to handle multiple
        // connections in parallel, so we instead spawn the future and
        // return an "empty" future that immediately resolves so that
        // Tokio will _simultaneously_ accept new connections and
        // service this one.
        tokio::spawn(handle_conn)
    });

// The `server` variable above is itself a Future, and hasn't actually
// done any work yet to set up the server. We need to run it on a Tokio
// runtime for the server to really get up and running:
tokio::run(server);
# }
```

More examples can be found [here][examples].

[`std::io::Read`]: https://doc.rust-lang.org/std/io/trait.Read.html
[`mio`]: {{< api-url "mio" >}}
[`tokio`]: {{< api-url "tokio" >}}
[`tokio-fs`]: {{< api-url "tokio" >}}/fs/index.html
[cross platform]: {{< api-url "mio" >}}/#platforms
[file operations]: {{< api-url "tokio" >}}/fs/index.html
[TCP]: {{< api-url "tokio" >}}/net/tcp/index.html
[UDP]: {{< api-url "tokio" >}}/net/udp/index.html
[Unix]: {{< api-url "tokio" >}}/net/unix/index.html
[examples]: https://github.com/tokio-rs/tokio/tree/master/tokio/examples
