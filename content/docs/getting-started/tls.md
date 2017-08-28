+++
title = "Example: a toy HTTP+TLS client using core"
menu = "getting_started"
weight = 108
+++

Much of the functionality throughout the Tokio stack is generic, so as to be as
flexible as possible. A great way to show an example of that is to explore how
we might make a simple HTTP request over HTTPS using TLS. In this example we'll
only use `tokio-core` for now rather than `tokio-proto`, but the concepts
should translate quite readily.

Let's take a look at what a simple fetch of `https://www.rust-lang.org/` might
look like:

```rust
# #![deny(deprecated)]
extern crate futures;
extern crate native_tls;
extern crate tokio_core;
extern crate tokio_io;
extern crate tokio_tls;

use std::io;
use std::net::ToSocketAddrs;

use futures::Future;
use native_tls::TlsConnector;
use tokio_core::net::TcpStream;
use tokio_core::reactor::Core;
use tokio_tls::TlsConnectorExt;

fn main() {
    let mut core = Core::new().unwrap();
    let handle = core.handle();
    let addr = "www.rust-lang.org:443".to_socket_addrs().unwrap().next().unwrap();

    let cx = TlsConnector::builder().unwrap().build().unwrap();
    let socket = TcpStream::connect(&addr, &handle);

    let tls_handshake = socket.and_then(|socket| {
        let tls = cx.connect_async("www.rust-lang.org", socket);
        tls.map_err(|e| {
            io::Error::new(io::ErrorKind::Other, e)
        })
    });
    let request = tls_handshake.and_then(|socket| {
        tokio_io::io::write_all(socket, "\
            GET / HTTP/1.0\r\n\
            Host: www.rust-lang.org\r\n\
            \r\n\
        ".as_bytes())
    });
    let response = request.and_then(|(socket, _request)| {
        tokio_io::io::read_to_end(socket, Vec::new())
    });

    let (_socket, data) = core.run(response).unwrap();
    println!("{}", String::from_utf8_lossy(&data));
}
```

There's a lot to digest here, though, so let's walk through it
line-by-line. First up in `main()`:

```rust,ignore
let mut core = Core::new().unwrap();
let handle = core.handle();
let addr = "www.rust-lang.org:443".to_socket_addrs().unwrap().next().unwrap();
```

This is our standard version of creating an event loop and adding a handle to it.
As an added piece here we're using the standard library's [`to_socket_addrs`] to
resolve the hostname `www.rust-lang.org` before our event loop runs. Note that
this DNS query happens synchronously, but there are a number of options for
asynchronous DNS queries in the ecosystem.

[`to_socket_addrs`]: https://doc.rust-lang.org/std/net/trait.ToSocketAddrs.html

Next up we see:

```rust,ignore
let cx = TlsConnector::builder().unwrap().build().unwrap();
let socket = TcpStream::connect(&addr, &handle);
```

This uses the [`native-tls`] crate to create an instance of [`TlsConnector`]
which is used to create new TLS connections. This is where TLS settings can
be configured, but for us all of the defaults will work fine.

Afterwards, we issue a connection to `www.rust-lang.org` to the previously
resolved address, using [`TcpStream::connect`]. Note that this returns a future
as we don't actually have the socket yet. It will be fully connected
at some later point in time.

[`native-tls`]: https://github.com/sfackler/rust-native-tls
[`TlsConnector`]: https://docs.rs/native-tls/0.1/native_tls/struct.TlsConnector.html
[`TcpStream::connect`]: https://tokio-rs.github.io/tokio-core/tokio_core/net/struct.TcpStream.html#method.connect

Once our socket is available, we need to perform three tasks to download the
rust-lang.org home page:

1. Perform a TLS handshake. The home page is only served over HTTPS, and we've
   connected to port 443 and we'll have to obey the TLS protocol.
2. An HTTP 'GET' request needs to be issued. For the purposes of this tutorial
   we will write the request by hand, though in a serious program you would
   use an HTTP client built on futures.
3. Finally, we download the response by reading off all the data on the socket.

Let's take a look at each of these steps in detail, the first being:

```rust,ignore
let tls_handshake = socket.and_then(|socket| {
    let tls = cx.connect_async("www.rust-lang.org", socket);
    tls.map_err(|e| {
        io::Error::new(io::ErrorKind::Other, e)
    })
});
```
[`Future`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html

Here, we use the [`and_then`] method on the [`Future`] trait to continue
building on the future returned by [`TcpStream::connect`]. The [`and_then`] method
takes a closure which receives the resolved value of this previous future. In
this case, `socket` will have type [`TcpStream`]. The [`and_then`] closure,
however, will not run if [`TcpStream::connect`] returned an error.

[`and_then`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.and_then
[`TcpStream`]: https://tokio-rs.github.io/tokio-core/tokio_core/net/struct.TcpStream.html

Once we have our `socket`, we use our previously created TLS connector to
initiate the TLS handshake through the [`connect_async`] method provided by the
[`tokio-tls`] crate. The first argument is the domain name we're connecting to,
with the I/O object as the second.

[`connect_async`]: https://docs.rs/tokio-tls/0.1/tokio_tls/trait.TlsConnectorExt.html#tymethod.connect_async
[`tokio-tls`]: https://github.com/tokio-rs/tokio-tls

Like with [`TcpStream::connect`] from before, the [`connect_async`] method
returns a future. The actual TLS handshake may take some time as the
client and server need to perform some I/O, agree on certificates,
etc. Once resolved, however, the future will become a [`TlsStream`],
similar to our previous [`TcpStream`]

[`TlsStream`]: https://docs.rs/tokio-tls/0.1/tokio_tls/struct.TlsStream.html

The [`and_then`] combinator is doing some heavy lifting behind the
scenes here by ensuring that it executes futures in the right order
and keeping track of the futures in flight. Even better, the value
returned from [`and_then`] itself implements [`Future`], so we can
keep chaining computations!

Next up, we issue our HTTP request:

```rust,ignore
let request = tls_handshake.and_then(|socket| {
    tokio_io::io::write_all(socket, "\
        GET / HTTP/1.0\r\n\
        Host: www.rust-lang.org\r\n\
        \r\n\
    ".as_bytes())
});
```

Here we take the future from the previous step, `tls_handshake`, and
use [`and_then`] again to continue the computation. The [`write_all`]
combinator writes the entirety of our HTTP request, issuing multiple
writes as necessary. Here we're just doing a simple HTTP/1.0 request,
so there's not much we need to write.

[`write_all`]: https://tokio-rs.github.io/tokio-core/tokio_core/io/fn.write_all.html

The future returned by [`write_all`] will complete once all the data
has been written to the socket. Note that behind the scenes the
[`TlsStream`] will actually be encrypting all the data we write before
sending it to the underlying socket.

And the third and final piece of our request looks like:

```rust,ignore
let response = request.and_then(|(socket, _request)| {
    tokio_io::io::read_to_end(socket, Vec::new())
});
```

The previous `request` future is chained again to the final future,
the [`read_to_end`] combinator. This future will read all data from the
`socket` provided and place it into the buffer provided (in this case an empty
one), and resolve to the buffer itself once the underlying connection hits EOF.

[`read_to_end`]: https://tokio-rs.github.io/tokio-core/tokio_core/io/fn.read_to_end.html

Like before, though, reads from the `socket` are actually decrypting data
received from the server under the covers, so we're just reading the decrypted
version!

If we were to return at this point in the program, you might be surprised to see
that nothing happens when it's run! That's because all we've done so
far is construct a futures-based computation; we haven't actually run it. Up to
this point in the program we've done no I/O, issued no HTTP requests, etc.

To actually execute our future and drive it to completion we'll need to run the
event loop:

```rust,ignore
let (_socket, data) = core.run(response).unwrap();
println!("{}", String::from_utf8_lossy(&data));
```

Here we pass our `response` future, our entire HTTP request, to
the event loop, [asking it to resolve the future][`core_run`]. The event loop will
then run until the future has been resolved, returning the result of the future,
which in this case is `io::Result<(TcpStream, Vec<u8>)>`.

[`core_run`]: https://tokio-rs.github.io/tokio-core/tokio_core/reactor/struct.Core.html#method.run

Note that this `core.run(...)` call will block the calling thread until the
future can itself be resolved. This means that `data` here has type `Vec<u8>`.
We then print it out to stdout as usual.
