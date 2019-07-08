---
title: "Example: A Chat Server"
weight : 7050
menu:
  docs:
    parent: going_deeper
---

We're going to use what has been covered so far to build a chat server. This is
a non-trivial Tokio server application.

The server is going to use a line-based protocol. Lines are terminated by
`\r\n`. This is compatible with telnet, so we will just use telnet for the
client. When a client connects, it must identify itself by sending a line
containing its "nick" (i.e., some name used to identify the client amongst its
peers).

Once a client is identified, all sent lines are prefixed with `[nick]: ` and
broadcasted to all other connected clients.

The full code can be found [here][full-code]. Note that Tokio provides some additional
abstractions that have not yet been covered that would enable the chat server to
be written with less code.

# Setup

First, generate a new crate.

```shell
$ cargo new --bin line-chat
cd line-chat
```

Next, add the necessary dependencies:

```toml
[dependencies]
tokio = "0.1"
tokio-io = "0.1"
futures = "0.1"
bytes = "0.4"
```

and the crates and types into scope in `main.rs`:

```rust
# #![deny(deprecated)]
extern crate tokio;
#[macro_use]
extern crate futures;
extern crate bytes;

use tokio::io;
use tokio::net::{TcpListener, TcpStream};
use tokio::prelude::*;
use futures::sync::mpsc;
use futures::future::{self, Either};
use bytes::{BytesMut, Bytes, BufMut};

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

/// Shorthand for the transmit half of the message channel.
type Tx = mpsc::UnboundedSender<Bytes>;

/// Shorthand for the receive half of the message channel.
type Rx = mpsc::UnboundedReceiver<Bytes>;
# fn main() {}
```

Now, we setup the necessary structure for a server. These are the same steps
that were used as part of the [Hello World!] example:

* Bind a `TcpListener` to a local port.
* Define a task that accepts inbound connections and processes them.
* Start the Tokio runtime
* Spawn the server task.

Again, no work actually happens until the server task is spawned on the
executor.

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate futures;
#
# use tokio::prelude::*;
# use tokio::net::TcpListener;
fn main() {
    let addr = "127.0.0.1:6142".parse().unwrap();
    let listener = TcpListener::bind(&addr).unwrap();

    let server = listener.incoming().for_each(move |socket| {
        // TODO: Process socket
        Ok(())
    })
    .map_err(|err| {
        // Handle error by printing to STDOUT.
        println!("accept error = {:?}", err);
    });

    println!("server running on localhost:6142");
# let server = server.select(futures::future::ok(())).then(|_| Ok(()));

    // Start the server
    //
    // This does a few things:
    //
    // * Start the Tokio runtime (reactor, threadpool, etc...)
    // * Spawns the `server` task onto the runtime.
    // * Blocks the current thread until the runtime becomes idle, i.e. all
    //   spawned tasks have completed.
    tokio::run(server);
}
```

# Chat State

A chat server requires that messages received from one client are broadcasted to
all other connected clients. This will be done using [message passing] over
[mpsc] channels.

Each client socket will be managed by a task. Each task will have an associated
[mpsc] channel that is used to receive messages from other clients. The send
half of all these channels is stored in an `Rc` cell in order to make them
accessible.

In this example, we are going to be using **unbounded** channels. Ideally,
channels should never be unbounded, but handling backpressure in this kind of
situation is a bit tricky. We will leave bounding the channels to a later
section dedicated to handling backpressure.

Here is how the shared state is defined (the `Tx` type alias was done above):

```rust
# #![deny(deprecated)]
# use std::collections::HashMap;
# use std::net::SocketAddr;
# struct Tx;
struct Shared {
    peers: HashMap<SocketAddr, Tx>,
}
# fn main() {}
```

Then, at the very top of the `main` function, the state instance is created.
This state instance will be moved into the task that accepts incoming
connections.

```rust
# #![deny(deprecated)]
# use std::sync::{Arc, Mutex};
# type Shared = String;
# fn main() {
let state = Arc::new(Mutex::new(Shared::new()));
# }
```

Now we can handle processing incoming connections. The server task is updated to
this:

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate futures;
# use tokio::net::{TcpListener, TcpStream};
# use futures::prelude::*;
# fn dox() {
# let addr = "127.0.0.1:6142".parse().unwrap();
# let listener = TcpListener::bind(&addr).unwrap();
# fn process(_: TcpStream, _: String) {}
# let state = String::new();
listener.incoming().for_each(move |socket| {
    process(socket, state.clone());
    Ok(())
})
# ;
# }
# fn main() {}
```

The server task passes all sockets along with a clone of the server state to a
`process` function. Let's define that function. It will have a structure like
this:

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate futures;
# use futures::future;
# use tokio::net::TcpStream;
# use std::sync::{Arc, Mutex};
# type Shared = String;
fn process(socket: TcpStream, state: Arc<Mutex<Shared>>) {
    // Define the task that processes the connection.
# /*
    let task = unimplemented!();
# */ let task = future::ok(());

    // Spawn the task
    tokio::spawn(task);
}
# fn main() {}
```

The call to `tokio::spawn` will spawn a new task onto the current Tokio runtime.
All the worker threads keep a reference to the current runtime stored in a
thread-local variable. Note, attempting to call `tokio::spawn` from outside of
the Tokio runtime will result in a panic.

All the connection processing logic has to be able to do is understand the
protocol. The protocol is line-based, terminated by `\r\n`.  Instead of working
at the byte stream level, it is much easier to work at the frame level, i.e.
working with values that represent atomic messages.

We implement a codec that holds the socket and exposes an API that takes and
consumes lines.

# Line Codec

A codec is a loose term for a type that takes a byte stream type (`AsyncRead +
AsyncWrite`) and exposes a read and write API at the frame level. The
[`tokio-io`] crate provides additional helpers for writing codecs, in this
example, we are going to do it by hand.

The `Lines` codec is defined as such:

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate bytes;
# use tokio::net::TcpStream;
# use bytes::BytesMut;
struct Lines {
    socket: TcpStream,
    rd: BytesMut,
    wr: BytesMut,
}

impl Lines {
    /// Create a new `Lines` codec backed by the socket
    fn new(socket: TcpStream) -> Self {
        Lines {
            socket,
            rd: BytesMut::new(),
            wr: BytesMut::new(),
        }
    }
}
# fn main() {}
```

Data read from the socket is buffered into `rd`. When a full line is read, it is
returned to the caller. Lines submitted by the caller to write to the socket are
buffered into `wr`, then flushed.

This is how the read half is implemented:

```rust
# #![deny(deprecated)]
# extern crate bytes;
# extern crate tokio;
# #[macro_use]
# extern crate futures;
# #[macro_use]
# use bytes::BytesMut;
# use tokio::io;
# use tokio::net::TcpStream;
# use tokio::prelude::*;
# struct Lines {
#     socket: TcpStream,
#     rd: BytesMut,
#     wr: BytesMut,
# }
impl Stream for Lines {
    type Item = BytesMut;
    type Error = io::Error;

    fn poll(&mut self) -> Result<Async<Option<Self::Item>>, Self::Error> {
        // First, read any new data that might have been received
        // off the socket
        //
        // We track if the socket is closed here and will be used
        // to inform the return value below.
        let sock_closed = self.fill_read_buf()?.is_ready();

        // Now, try finding lines
        let pos = self.rd.windows(2)
            .position(|bytes| bytes == b"\r\n");

        if let Some(pos) = pos {
            // Remove the line from the read buffer and set it
            // to `line`.
            let mut line = self.rd.split_to(pos + 2);

            // Drop the trailing \r\n
            line.split_off(pos);

            // Return the line
            return Ok(Async::Ready(Some(line)));
        }

        if sock_closed {
            Ok(Async::Ready(None))
        } else {
            Ok(Async::NotReady)
        }
    }
}

impl Lines {
    fn fill_read_buf(&mut self) -> Result<Async<()>, io::Error> {
        loop {
            // Ensure the read buffer has capacity.
            //
            // This might result in an internal allocation.
            self.rd.reserve(1024);

            // Read data into the buffer.
            //
            // The `read_buf` fn is provided by `AsyncRead`.
            let n = try_ready!(self.socket.read_buf(&mut self.rd));

            if n == 0 {
                return Ok(Async::Ready(()));
            }
        }
    }
}
# fn main() {}
```

The example uses [`BytesMut`] from the [`bytes`] crate. This provides some nice
utilities for working with byte sequences in a networking context. The
[`Stream`] implementation yields `BytesMut` values which contain exactly one
line.

As always, the key to implementing a function that returns `Async` is to never
return `Async::NotReady` unless the function implementation received an
`Async::NotReady` itself. In this example, `NotReady` is only returned if
`fill_read_buf` returns `NotReady` and `fill_read_buf` only returns `NotReady`
if `TcpStream::read_buf` returns `NotReady`.

Now, for the write half.

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate bytes;
# #[macro_use]
# extern crate futures;
# use tokio::io;
# use tokio::net::TcpStream;
# use tokio::prelude::*;
# use bytes::{BytesMut, BufMut};
struct Lines {
    socket: TcpStream,
    rd: BytesMut,
    wr: BytesMut,
}
impl Lines {
    fn buffer(&mut self, line: &[u8]) {
        // Push the line onto the end of the write buffer.
        //
        // The `put` function is from the `BufMut` trait.
        self.wr.put(line);
    }

    fn poll_flush(&mut self) -> Poll<(), io::Error> {
        // As long as there is buffered data to write, try to write it.
        while !self.wr.is_empty() {
            // Try to write some bytes to the socket
            let n = try_ready!(self.socket.poll_write(&self.wr));

            // As long as the wr is not empty, a successful write should
            // never write 0 bytes.
            assert!(n > 0);

            // This discards the first `n` bytes of the buffer.
            let _ = self.wr.split_to(n);
        }

        Ok(Async::Ready(()))
    }
}
fn main() {}
```

The caller queues up all lines by calling `buffer`. This appends the line to the
internal `wr` buffer. Then, once all data is queued up, the caller calls
`poll_flush`, which does the actual writing to the socket. `poll_flush` only
returns `Ready` once all the queued data has been successfully written to the
socket.

Similar to the read half, `NotReady` is only returned when the function
implementation received `NotReady` itself.

And the `Lines` codec is used in the `process` function as such:

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate bytes;
# use tokio::net::TcpStream;
# use tokio::prelude::*;
# use bytes::BytesMut;
# use std::io;
# use std::sync::{Arc, Mutex};
# type Shared = String;
# struct Lines;
# impl Lines {
# fn new(_: TcpStream) -> Self { unimplemented!() }
# }
# impl Stream for Lines {
#     type Item = BytesMut;
#     type Error = io::Error;
#     fn poll(&mut self) -> Poll<Option<Self::Item>, io::Error> { unimplemented!() }
# }
fn process(socket: TcpStream, state: Arc<Mutex<Shared>>) {
    // Wrap the socket with the `Lines` codec that we wrote above.
    let lines = Lines::new(socket);

    // The first line is treated as the client's name. The client
    // is not added to the set of connected peers until this line
    // is received.
    //
    // We use the `into_future` combinator to extract the first
    // item from the lines stream. `into_future` takes a `Stream`
    // and converts it to a future of `(first, rest)` where `rest`
    // is the original stream instance.
    let connection = lines.into_future()
        // `into_future` doesn't have the right error type, so map
        // the error to make it work.
        .map_err(|(e, _)| e)
        // Process the first received line as the client's name.
        .and_then(|(name, lines)| {
            let name = match name {
                Some(name) => name,
                None => {
                    // TODO: Handle a client that disconnects
                    // early.
                    unimplemented!();
                }
            };

            // TODO: Rest of the process function
# Ok(())
        });
}
# fn main() {}
```

# Broadcasting Messages

The next step is to implement the connection processing logic that handles the
actual chat functionality, i.e. broadcasting messages from one client to all the
others.

To implement this, we will explicitly implement a [`Future`] that takes the
`Lines` codec instance and handles the broadcasting logic. This logic handles:

1. Receive messages on its message channel and write them to the socket.
2. Receive messages from the socket and broadcast them to all peers.

Implementing this logic entirely with combinators is also possible, but requires
using [`split`], which hasn't been covered yet. Also, this provides an
opportunity to see how to implement a non-trivial [`Future`] by hand.

Here is the definition of the future that processes the broadcast logic for a
connection:

```rust
# use std::net::SocketAddr;
# use std::sync::{Arc, Mutex};
# type BytesMut = ();
# type Lines = ();
# type Shared = ();
# type Rx = ();
struct Peer {
    /// Name of the peer. This is the first line received from the client.
    name: BytesMut,

    /// The TCP socket wrapped with the `Lines` codec.
    lines: Lines,

    /// Handle to the shared chat state.
    state: Arc<Mutex<Shared>>,

    /// Receive half of the message channel.
    ///
    /// This is used to receive messages from peers. When a message is received
    /// off of this `Rx`, it will be written to the socket.
    rx: Rx,

    /// Client socket address.
    ///
    /// The socket address is used as the key in the `peers` HashMap. The
    /// address is saved so that the `Peer` drop implementation can clean up its
    /// entry.
    addr: SocketAddr,
}
# fn main() {}
```

And a `Peer` instance is created as such:

```rust
# extern crate bytes;
# extern crate futures;
# extern crate tokio;
# use bytes::{BytesMut, Bytes};
# use futures::sync::mpsc;
# use tokio::net::TcpStream;
# use tokio::prelude::*;
# use std::net::SocketAddr;
# use std::collections::HashMap;
# use std::sync::{Arc, Mutex};
# struct Peer {
#     name: BytesMut,
#     lines: Lines,
#     state: Arc<Mutex<Shared>>,
#     rx: Rx,
#     addr: SocketAddr,
# }
# struct Shared {
#     peers: HashMap<SocketAddr, Tx>,
# }
# struct Lines {
#     socket: TcpStream,
# }
# type Tx = mpsc::UnboundedSender<Bytes>;
# type Rx = mpsc::UnboundedReceiver<Bytes>;
impl Peer {
    fn new(name: BytesMut,
           state: Arc<Mutex<Shared>>,
           lines: Lines) -> Peer
    {
        // Get the client socket address
        let addr = lines.socket.peer_addr().unwrap();

        // Create a channel for this peer
        let (tx, rx) = mpsc::unbounded();

        // Add an entry for this `Peer` in the shared state map.
        state.lock().unwrap()
            .peers.insert(addr, tx);

        Peer {
            name,
            lines,
            state,
            rx,
            addr,
        }
    }
}
# fn main() {}
```

A [mpsc] channel is created for other peers to send their messages to this
newly created peer. After creating the channel, the transmit half is inserted
into the peers map. This entry is removed in the drop implementation for
`Peer`.

```rust
# use std::net::SocketAddr;
# use std::collections::HashMap;
# use std::sync::{Arc, Mutex};
# struct Peer {
#     state: Arc<Mutex<Shared>>,
#     addr: SocketAddr,
# }
# struct Shared {
#     peers: HashMap<SocketAddr, ()>,
# }
impl Drop for Peer {
    fn drop(&mut self) {
        self.state.lock().unwrap().peers
            .remove(&self.addr);
    }
}
# fn main() {}
```

And here is the implementation.

```rust
# extern crate tokio;
# extern crate futures;
# extern crate bytes;
# use tokio::io;
# use tokio::prelude::*;
# use futures::sync::mpsc;
# use bytes::{Bytes, BytesMut, BufMut};
# use std::net::SocketAddr;
# use std::collections::HashMap;
# use std::sync::{Arc, Mutex};
# struct Peer {
#     name: BytesMut,
#     lines: Lines,
#     state: Arc<Mutex<Shared>>,
#     rx: Rx,
#     addr: SocketAddr,
# }
# struct Shared {
#     peers: HashMap<SocketAddr, Tx>,
# }
# struct Lines;
# type Tx = mpsc::UnboundedSender<Bytes>;
# type Rx = mpsc::UnboundedReceiver<Bytes>;
# impl Lines {
#     fn buffer(&mut self, _: &[u8]) { unimplemented!() }
#     fn poll_flush(&mut self) -> Poll<(), io::Error> { unimplemented!() }
# }
# impl Stream for Lines {
#     type Item = BytesMut;
#     type Error = io::Error;
#     fn poll(&mut self) -> Poll<Option<Self::Item>, Self::Error> {
#         unimplemented!();
#     }
# }
impl Future for Peer {
    type Item = ();
    type Error = io::Error;

    fn poll(&mut self) -> Poll<(), io::Error> {
        // Receive all messages from peers.
        loop {
            // Polling an `UnboundedReceiver` cannot fail, so `unwrap`
            // here is safe.
            match self.rx.poll().unwrap() {
                Async::Ready(Some(v)) => {
                    // Buffer the line. Once all lines are buffered,
                    // they will be flushed to the socket (right
                    // below).
                    self.lines.buffer(&v);
                }
                _ => break,
            }
        }

        // Flush the write buffer to the socket
        let _ = self.lines.poll_flush()?;

        // Read new lines from the socket
        while let Async::Ready(line) = self.lines.poll()? {
            println!("Received line ({:?}) : {:?}", self.name, line);

            if let Some(message) = line {
                // Append the peer's name to the front of the line:
                let mut line = self.name.clone();
                line.put(": ");
                line.put(&message);
                line.put("\r\n");

                // We're using `Bytes`, which allows zero-copy clones
                // (by storing the data in an Arc internally).
                //
                // However, before cloning, we must freeze the data.
                // This converts it from mutable -> immutable,
                // allowing zero copy cloning.
                let line = line.freeze();

                // Now, send the line to all other peers
                for (addr, tx) in &self.state.lock().unwrap().peers {
                    // Don't send the message to ourselves
                    if *addr != self.addr {
                        // The send only fails if the rx half has been
                        // dropped, however this is impossible as the
                        // `tx` half will be removed from the map
                        // before the `rx` is dropped.
                        tx.unbounded_send(line.clone()).unwrap();
                    }
                }
            } else {
                // EOF was reached. The remote client has disconnected.
                // There is nothing more to do.
                return Ok(Async::Ready(()));
            }
        }

        // As always, it is important to not just return `NotReady`
        // without ensuring an inner future also returned `NotReady`.
        //
        // We know we got a `NotReady` from either `self.rx` or
        // `self.lines`, so the contract is respected.
        Ok(Async::NotReady)
    }
}
# fn main() {}
```

# Final Touches

All that remains is wiring up the `Peer` future that was just implemented. To do
this, the client connection task (defined in the `process` function) is extended
to use `Peer`.

```rust
# extern crate tokio;
# extern crate futures;
# use tokio::io;
# use tokio::prelude::*;
# use futures::future::{self, Either, empty};
# type Lines = Box<Stream<Item = (), Error = io::Error>>;
# struct Peer;
# impl Peer {
#     fn new(_: (), state: (), lines: Lines) -> impl Future<Item = (), Error = io::Error> {
#         empty()
#     }
# }
# fn dox(lines: Lines) {
# let state = ();
let connection = lines.into_future()
    .map_err(|(e, _)| e)
    .and_then(|(name, lines)| {
        // If `name` is `None`, then the client disconnected without
        // actually sending a line of data.
        //
        // Since the connection is closed, there is no further work
        // that we need to do. So, we just terminate processing by
        // returning `future::ok()`.
        //
        // The problem is that only a single future type can be
        // returned from a combinator closure, but we want to
        // return both `future::ok()` and `Peer` (below).
        //
        // This is a common problem, so the `futures` crate solves
        // this by providing the `Either` helper enum that allows
        // creating a single return type that covers two concrete
        // future types.
        let name = match name {
            Some(name) => name,
            None => {
                // The remote client closed the connection without
                // sending any data.
                return Either::A(future::ok(()));
            }
        };

        println!("`{:?}` is joining the chat", name);

        // Create the peer.
        //
        // This is also a future that processes the connection, only
        // completing when the socket closes.
        let peer = Peer::new(
            name,
            state,
            lines);

        // Wrap `peer` with `Either::B` to make the return type fit.
        Either::B(peer)
    })
    // Task futures have an error of type `()`, this ensures we handle
    // the error. We do this by printing the error to STDOUT.
    .map_err(|e| {
        println!("connection error = {:?}", e);
    });
# }
# fn main() {}
```

Besides just adding `Peer`, `name == None` is also handled. In this case, the
remote client terminated before identifying itself.

Returning multiple futures (the `name == None` handler and `Peer`) is handled by
wrapping the returned futures in [`Either`]. [`Either`] is an enum that accepts
a different future type for each variant. This allows returning multiple future
types without reaching for trait objects.

The full code can be found [here][full-code].

[full-code]: https://github.com/tokio-rs/tokio/tree/v0.1.x/tokio/examples/chat.rs
[Hello World!]: {{< ref "/docs/getting-started/hello-world.md" >}}
[message passing]: {{< ref "/docs/going-deeper/tasks.md#message-passing" >}}
[mpsc]: {{< api-url "futures" >}}/sync/mpsc/index.html
[`BytesMut`]: {{< api-url "bytes" >}}/struct.BytesMut.html
[`Future`]: {{< api-url "futures" >}}/future/trait.Future.html
[`Stream`]: {{< api-url "futures" >}}/stream/trait.Stream.html
[`bytes`]: {{< api-url "bytes" >}}
[`split`]: {{< api-url "tokio-io" >}}/trait.AsyncRead.html#method.split
[`tokio-io`]: {{< api-url "tokio-io" >}}
[`Either`]: {{< api-url "futures" >}}/future/enum.Either.html
