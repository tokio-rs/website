+++
title = "Example: a toy HTTP+TLS client using core"
menu = "getting_started"
weight = 8
+++

TODO: update this, make it fit in with the rest of the flow

```rust
extern crate futures;
extern crate tokio_core;
extern crate tokio_tls;

use std::net::ToSocketAddrs;

use futures::Future;
use tokio_core::reactor::Core;
use tokio_core::net::TcpStream;
use tokio_tls::ClientContext;

fn main() {
    let mut core = Core::new().unwrap();
    let addr = "www.rust-lang.org:443".to_socket_addrs().unwrap().next().unwrap();

    let socket = TcpStream::connect(&addr, &core.handle());

    let tls_handshake = socket.and_then(|socket| {
        let cx = ClientContext::new().unwrap();
        cx.handshake("www.rust-lang.org", socket)
    });
    let request = tls_handshake.and_then(|socket| {
        tokio_core::io::write_all(socket, "\
            GET / HTTP/1.0\r\n\
            Host: www.rust-lang.org\r\n\
            \r\n\
        ".as_bytes())
    });
    let response = request.and_then(|(socket, _)| {
        tokio_core::io::read_to_end(socket, Vec::new())
    });

    let (_, data) = core.run(response).unwrap();
    println!("{}", String::from_utf8_lossy(&data));
}
```

If you place that file in `src/main.rs`, and then execute `cargo run`, you
should see the HTML of the Rust home page!

There's a lot to digest here, though, so let's walk through it
line-by-line. First up in `main()`:

```rust
let mut core = Core::new().unwrap();
let addr = "www.rust-lang.org:443".to_socket_addrs().unwrap().next().unwrap();
```

Here we [create an event loop][core-new] on which we will perform all our
I/O. Then we resolve the "www.rust-lang.org" host name by using
the standard library's [`to_socket_addrs`] method.

[core-new]: https://tokio-rs.github.io/tokio-core/tokio_core/reactor/struct.Core.html#method.new
[`to_socket_addrs`]: https://doc.rust-lang.org/std/net/trait.ToSocketAddrs.html

Next up:

```rust
let socket = TcpStream::connect(&addr, &core.handle());
```

We [get a handle] to our event loop and connect to the host with
[`TcpStream::connect`]. Note, though, that [`TcpStream::connect`] returns a
future! This means that we don't actually have the socket yet, but rather it
will be fully connected at some later point in time.

[get a handle]: https://tokio-rs.github.io/tokio-core/tokio_core/reactor/struct.Core.html#method.handle
[`TcpStream::connect`]: https://tokio-rs.github.io/tokio-core/tokio_core/net/struct.TcpStream.html#method.connect

Once our socket is available we need to perform three tasks to download the
rust-lang.org home page:

1. Perform a TLS handshake. The home page is only served over HTTPS, so we had
   to connect to port 443 and we'll have to obey the TLS protocol.
2. An HTTP 'GET' request needs to be issued. For the purposes of this tutorial
   we will write the request by hand, though in a serious program you would
   use an HTTP client built on futures.
3. Finally, we download the response by reading off all the data on the socket.

Let's take a look at each of these steps in detail, the first being:

```rust
let tls_handshake = socket.and_then(|socket| {
    let cx = ClientContext::new().unwrap();
    cx.handshake("www.rust-lang.org", socket)
});
```

Here we use the [`and_then`] method on the [`Future`] trait to continue
building on the future returned by [`TcpStream::connect`]. The [`and_then`] method
takes a closure which receives the resolved value of this previous future. In
this case `socket` will have type [`TcpStream`]. The [`and_then`] closure,
however, will not run if [`TcpStream::connect`] returned an error.

[`and_then`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.and_then
[`TcpStream`]: https://tokio-rs.github.io/tokio-core/tokio_core/net/struct.TcpStream.html

Once we have our `socket`, we create a client TLS context via
[`ClientContext::new`]. This type from the [`tokio-tls`] crate
represents the client half of a TLS connection. Next we call the
[`handshake`] method to actually perform the TLS handshake. The first
argument is the domain name we're connecting to, with the I/O object
as the second.

[`ClientContext::new`]: https://tokio-rs.github.io/tokio-tls/tokio_tls/struct.ClientContext.html#method.new
[`handshake`]: https://tokio-rs.github.io/tokio-tls/tokio_tls/struct.ClientContext.html#method.handshake

Like with [`TcpStream::connect`] from before, the [`handshake`] method
returns a future. The actual TLS handshake may take some time as the
client and server need to perform some I/O, agree on certificates,
etc. Once resolved, however, the future will become a [`TlsStream`],
similar to our previous [`TcpStream`]

[`TlsStream`]: https://tokio-rs.github.io/tokio-tls/tokio_tls/struct.TlsStream.html

The [`and_then`] combinator is doing some heavy lifting behind the
scenes here by ensuring that it executes futures in the right order
and keeping track of the futures in flight. Even better, the value
returned from [`and_then`] itself implements [`Future`], so we can
keep chaining computation!

Next up, we issue our HTTP request:

```rust
let request = tls_handshake.and_then(|socket| {
    tokio_core::io::write_all(socket, "\
        GET / HTTP/1.0\r\n\
        Host: www.rust-lang.org\r\n\
        \r\n\
    ".as_bytes())
});
```

Here we take the future from the previous step, `tls_handshake`, and
use [`and_then`] again to continue the computation. The [`write_all`]
combinator writes the entirety of our HTTP request, issueing multiple
writes as necessary. Here we're just doing a simple HTTP/1.0 request,
so there's not much we need to write.

[`write_all`]: https://tokio-rs.github.io/tokio-core/tokio_core/io/fn.write_all.html

The future returned by [`write_all`] will complete once all the data
has been written to the socket. Note that behind the scenes the
[`TlsStream`] will actually be encrypting all the data we write before
sending it to the underlying socket.

And the third and final piece of our request looks like:

```rust
let response = request.and_then(|(socket, _)| {
    tokio_core::io::read_to_end(socket, Vec::new())
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
far is construct a future-based computation, we haven't actually run it. Up to
this point in the program we've done no I/O, issued no HTTP requests, etc.

To actually execute our future and drive it to completion we'll need to run the
event loop:

```rust
let (_, data) = core.run(response).unwrap();
println!("{}", String::from_utf8_lossy(&data));
```

Here we pass our `response` future, our entire HTTP request, to
the event loop, [asking it to resolve the future][`core_run`]. The event loop will
then run until the future has been resolved, returning the result of the future
which in this case is `io::Result<(TcpStream, Vec<u8>)>`.

[`core_run`]: https://tokio-rs.github.io/tokio-core/tokio_core/reactor/struct.Core.html#method.run

Note that this `core.run(..)` call will block the calling thread until the
future can itself be resolved. This means that `data` here has type `Vec<u8>`.
We then print it out to stdout as usual.

Phew! At this point we've seen futures [initiate a TCP
connection][`TcpStream::connect`] [create a chain of computation][`and_then`],
and [read data from a socket][`read_to_end`]. But this is only a hint of what
futures can do, so let's dive more into the traits themselves!
