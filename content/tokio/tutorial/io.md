---
title: "I/O"
---

I/O in Tokio operates in much the same way as `std`, but asynchronously. There
is a trait for reading ([`AsyncRead`]) and a trait for writing ([`AsyncWrite`]).
Specific types implement these traits as appropriate ([`TcpStream`], [`File`],
[`Stdout`]). [`AsyncRead`] and [`AsyncWrite`] are also implemented by a number
of data structures, such as `Vec<u8>` and `&[u8]`. This allows using byte arrays
where a reader or writer is expected.

This page will cover basic I/O reading and writing with Tokio and work through a
few examples. The next page will get into a more advanced I/O example.

# `AsyncRead` and `AsyncWrite`

These two traits provide the facilities to asynchronously read from and write to
byte streams. The methods on these traits are typically not called directly,
similar to how you don't manually call the `poll` method from the `Future`
trait. Instead, you will use them through the utility methods provided by
[`AsyncReadExt`] and [`AsyncWriteExt`].

Let's briefly look at a few of these methods. All of these functions are `async`
and must be used with `.await`.

## `async fn read()`

[`AsyncReadExt::read`][read] provides an async method for reading data into a
buffer, returning the number of bytes read.

**Note:** when `read()` returns `Ok(0)`, this signifies that the stream is
closed. Any further calls to `read()` will complete immediately with `Ok(0)`.
With [`TcpStream`] instances, this signifies that the read half of the socket is
closed.

```rust
use tokio::fs::File;
use tokio::io::{self, AsyncReadExt};

# fn dox() {
#[tokio::main]
async fn main() -> io::Result<()> {
    let mut f = File::open("foo.txt").await?;
    let mut buffer = [0; 10];

    // read up to 10 bytes
    let n = f.read(&mut buffer[..]).await?;

    println!("The bytes: {:?}", &buffer[..n]);
    Ok(())
}
# }
```

## `async fn read_to_end()`

[`AsyncReadExt::read_to_end`][read_to_end] reads all bytes from the stream until
EOF.

```rust
use tokio::io::{self, AsyncReadExt};
use tokio::fs::File;

# fn dox() {
#[tokio::main]
async fn main() -> io::Result<()> {
    let mut f = File::open("foo.txt").await?;
    let mut buffer = Vec::new();

    // read the whole file
    f.read_to_end(&mut buffer).await?;
    Ok(())
}
# }
```

## `async fn write()`

[`AsyncWriteExt::write`][write] writes a buffer into the writer, returning how
many bytes were written.

```rust
use tokio::io::{self, AsyncWriteExt};
use tokio::fs::File;

# fn dox() {
#[tokio::main]
async fn main() -> io::Result<()> {
    let mut file = File::create("foo.txt").await?;

    // Writes some prefix of the byte string, but not necessarily all of it.
    let n = file.write(b"some bytes").await?;

    println!("Wrote the first {} bytes of 'some bytes'.", n);
    Ok(())
}
# }
```

## `async fn write_all()`

[`AsyncWriteExt::write_all`][write_all] writes the entire buffer into the
writer.

```rust
use tokio::io::{self, AsyncWriteExt};
use tokio::fs::File;

# fn dox() {
#[tokio::main]
async fn main() -> io::Result<()> {
    let mut buffer = File::create("foo.txt").await?;

    buffer.write_all(b"some bytes").await?;
    Ok(())
}
# }
```

Both traits include a number of other helpful methods. See the API docs for a
comprehensive list.

# Helper functions

Additionally, just like `std`, the [`tokio::io`] module contains a number of
helpful utility functions as well as APIs for working with [standard in][stdin],
[standard out][stdout] and [standard error][stderr]. For example,
[`tokio::io::copy`][copy] asynchronously copies the entire contents of a reader
into a writer.

```rust
use tokio::fs::File;
use tokio::io;

# fn dox() {
#[tokio::main]
async fn main() -> io::Result<()> {
    let mut reader: &[u8] = b"hello";
    let mut file = File::create("foo.txt").await?;

    io::copy(&mut reader, &mut file).await?;
    Ok(())
}
# }
```

Note that this uses the fact that byte arrays also implement `AsyncRead`.

# Echo server

Let's practice doing some asynchronous I/O. We will be writing an echo server.

The echo server binds a `TcpListener` and accepts inbound connections in a loop.
For each inbound connection, data is read from the socket and written
immediately back to the socket. The client sends data to the server and receives
the exact same data back.

We will implement the echo server twice, using slightly different strategies.

## Using `io::copy()`

To start, we will implement the echo logic using the [`io::copy`][copy] utility.

This is a TCP server and needs an accept loop. A new task is spawned to process
each accepted socket.

```rust
use tokio::io;
use tokio::net::TcpListener;

# fn dox() {
#[tokio::main]
async fn main() -> io::Result<()> {
    let mut listener = TcpListener::bind("127.0.0.1:6142").await.unwrap();

    loop {
        let (mut socket, _) = listener.accept().await?;

        tokio::spawn(async move {
            // Copy data here
        });
    }
}
# }
```

As seen earlier, this utility function takes a reader and a writer and copies
data from one to the other. However, we only have a single `TcpStream`. This
single value implements **both** `AsyncRead` and `AsyncWrite`. Because
`io::copy` requires `&mut` for both the reader and the writer, the socket cannot
be used for both arguments.

```rust,compile_fail
// This fails to compile
io::copy(&mut socket, &mut socket).await
```

## Splitting a reader + writer

To work around this problem, we must split the socket into a reader handle and a
writer handle. The best way to split a reader/writer combo depends on the
specific type.

Any reader + writer type can be split using the [`io::split`][split] utility.
This function takes a single value and returns separate reader and  writer
handles. These two handles can be used independently, including from separate
tasks.

For example, the echo client could handle concurrent reads and writes like this:

```rust
use tokio::io::{self, AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

# fn dox() {
#[tokio::main]
async fn main() -> io::Result<()> {
    let socket = TcpStream::connect("127.0.0.1:6142").await?;
    let (mut rd, mut wr) = io::split(socket);

    // Write data in the background
    let write_task = tokio::spawn(async move {
        wr.write_all(b"hello\r\n").await?;
        wr.write_all(b"world\r\n").await?;

        // Sometimes, the rust type inferencer needs
        // a little help
        Ok::<_, io::Error>(())
    });

    let mut buf = vec![0; 128];

    loop {
        let n = rd.read(&mut buf).await?;

        if n == 0 {
            break;
        }

        println!("GOT {:?}", &buf[..n]);
    }

    Ok(())
}
# }
```

Because `io::split` supports **any** value that implements `AsyncRead +
AsyncWrite` and returns independent handles, internally `io::split` uses an
`Arc` and a `Mutex`. This overhead can be avoided with `TcpStream`. `TcpStream`
offers two specialized split functions.

[`TcpStream::split`] takes a **reference** to the stream and returns a reader
and writer handle. Because a reference is used, both handles must stay on the
**same** task that `split()` was called from. This specialized `split` is
zero-cost. There is no `Arc` or `Mutex` needed. `TcpStream` also provides
[`into_split`] which supports handles that can move across tasks at the cost of
only an `Arc`.

Because `io::copy()` is called on the same task that owns the `TcpStream`, we
can use [`TcpStream::split`]. The task that processes the echo logic becomes:

```rust
# use tokio::io;
# use tokio::net::TcpStream;
# fn dox(mut socket: TcpStream) {
tokio::spawn(async move {
    let (mut rd, mut wr) = socket.split();
    
    if io::copy(&mut rd, &mut wr).await.is_err() {
        eprintln!("failed to copy");
    }
});
# }
```

You can find the entire code [here][full].

[full]: https://github.com/tokio-rs/website/blob/master/tutorial-code/io/src/echo-server-copy.rs

## Manual copying

Now lets look at how we would write the echo server by copying the data
manually. To do this, we use [`AsyncReadExt::read`][read] and
[`AsyncWriteExt::write_all`][write_all].

The full echo server is as follows.

```rust
use tokio::io::{self, AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

# fn dox() {
#[tokio::main]
async fn main() -> io::Result<()> {
    let mut listener = TcpListener::bind("127.0.0.1:6142").await.unwrap();

    loop {
        let (mut socket, _) = listener.accept().await?;

        tokio::spawn(async move {
            let mut buf = vec![0; 1024];

            loop {
                match socket.read(&mut buf).await {
                    // Return value of `Ok(0)` signifies that the remote has
                    // closed
                    Ok(0) => return,
                    Ok(n) => {
                        // Copy the data back to socket
                        if socket.write_all(&buf[..n]).await.is_err() {
                            // Unexpected socket error. There isn't much we can
                            // do here so just stop processing.
                            return;
                        }
                    }
                    Err(_) => {
                        // Unexpected socket error. There isn't much we can do
                        // here so just stop processing.
                        return;
                    }
                }
            }
        });
    }
}
# }
```

Let's break it down. First, since the `AsyncRead` and `AsyncWrite` utilities are
used, the extension traits must be brought into scope.

```rust
use tokio::io::{self, AsyncReadExt, AsyncWriteExt};
```

## Allocating a buffer

The strategy is to read some data from the socket into a buffer then write the
contents of the buffer back to the socket.

```rust
let mut buf = vec![0; 1024];
```

A stack buffer is explicitly avoided. Recall from [earlier][send], we noted that
all task data that lives across calls to `.await` must be stored by the task. In
this case, `buf` is used across `.await` calls. All task data is stored in a
single allocation. You can think of it as an `enum` where each variant is the
data that needs to be stored for a specific call to `.await`.

If the buffer is represented by a stack array, the internal structure for tasks
spawned per accepted socket might look something like:

```rust,compile_fail
struct Task {
    // internal task fields here
    task: enum {
        AwaitingRead {
            socket: TcpStream,
            buf: [BufferType],
        },
        AwaitingWriteAll {
            socket: TcpStream,
            buf: [BufferType],
        }

    }
}
```

If a stack array is used as the buffer type, it will be stored *inline* in the
task structure. This will make the task structure very big. Additionally, buffer
sizes are often page sized. This will, in turn, make `Task` an awkward size:
`$page-size + a-few-bytes`.

The compiler optimizes the layout of async blocks further than a basic `enum`.
In practice, variables are not moved around between variants as would be
required with an `enum`. However, the task struct size is at least as big as the
largest variable.

Because of this, it is usually more efficient to use a dedicated allocation for
the buffer.

## Handling EOF

When the read half of the TCP stream is shut down, a call to `read()` returns
`Ok(0)`. It is important to exit the read loop at this point. Forgetting to
break from the read loop on EOF is a common source of bugs.

```rust
# use tokio::io::AsyncReadExt;
# use tokio::net::TcpStream;
# async fn dox(mut socket: TcpStream) {
# let mut buf = vec![0_u8; 1024];
loop {
    match socket.read(&mut buf).await {
        // Return value of `Ok(0)` signifies that the remote has
        // closed
        Ok(0) => return,
        // ... other cases handled here
# _ => unreachable!(),
    }
}
# }
```

Forgetting to break from the read loop usually results in a 100% CPU infinite
loop situation. As the socket is closed, `socket.read()` returns immediately.
The loop then repeats forever.

Full code is found [here][full]

[full]: https://github.com/tokio-rs/website/blob/master/tutorial-code/io/src/echo-server.rs
[send]: /tokio/tutorial/spawning#send-bound

[`AsyncRead`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncRead.html
[`AsyncWrite`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncWrite.html
[`AsyncReadExt`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncReadExt.html
[`AsyncWriteExt`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncWriteExt.html
[`TcpStream`]: https://docs.rs/tokio/0.2/tokio/net/struct.TcpStream.html
[`File`]: https://docs.rs/tokio/0.2/tokio/fs/struct.File.html
[`Stdout`]: https://docs.rs/tokio/0.2/tokio/io/struct.Stdout.html
[read]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncReadExt.html#method.read
[read_to_end]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncReadExt.html#method.read_to_end
[write]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncWriteExt.html#method.write
[`tokio::io`]: https://docs.rs/tokio/0.2/tokio/io/index.html
[stdin]: https://docs.rs/tokio/0.2/tokio/io/fn.stdin.html
[stdout]: https://docs.rs/tokio/0.2/tokio/io/fn.stdout.html
[stderr]: https://docs.rs/tokio/0.2/tokio/io/fn.stderr.html
[copy]: https://docs.rs/tokio/0.2/tokio/io/fn.copy.html
[split]: https://docs.rs/tokio/0.2/tokio/io/fn.split.html
[`TcpStream::split`]: https://docs.rs/tokio/0.2/tokio/net/struct.TcpStream.html#method.split
[`into_split`]: https://docs.rs/tokio/0.2/tokio/net/struct.TcpStream.html#method.into_split
