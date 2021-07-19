---
date: "2021-07-19"
title: "Announcing tokio-uring: io-uring support for Tokio"
description: "July 19, 2021"
---

Today, we published the first release of the “tokio-uring” crate, providing
support for the io-uring system API on Linux. This release provides asynchronous
File operations, and we will be adding support for more operations in subsequent
releases.

To use `tokio-uring`, first, add a dependency on the crate:

```toml
tokio-uring = "0.1.0"
```

Then, start a `tokio-uring` runtime and read from a file:

```rust
use tokio_uring::fs::File;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    tokio_uring::start(async {
        // Open a file
        let file = File::open("hello.txt").await?;

        let buf = vec![0; 4096];
        // Read some data, the buffer is passed by ownership and
        // submitted to the kernel. When the operation completes,
        // we get the buffer back.
        let (res, buf) = file.read_at(buf, 0).await;
        let n = res?;

        // Display the contents
        println!("{:?}", &buf[..n]);

        Ok(())
    })
}
```

The `tokio-uring` runtime uses a Tokio runtime under the hood, so it is
compatible with Tokio types and libraries (e.g.
[hyper](https://github.com/hyperium/hyper) and
[tonic](https://github.com/hyperium/tonic)). Here is the same example as above,
but instead of writing to STDOUT, we write to a Tokio TCP socket.

```rust
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;
use tokio_uring::fs::File;

fn main() {
    tokio_uring::start(async {
        // Start a TCP listener
        let listener = TcpListener::bind("0.0.0.0:8080").await.unwrap();

        // Accept new sockets
        loop {
            let (mut socket, _) = listener.accept().await.unwrap();

            // Spawn a task to send the file back to the socket
            tokio_uring::spawn(async move {
                // Open the file without blocking
                let file = File::open("hello.txt").await.unwrap();
                let mut buf = vec![0; 16 * 1_024];

                // Track the current position in the file;
                let mut pos = 0;

                loop {
                    // Read a chunk
                    let (res, b) = file.read_at(buf, pos).await;
                    let n = res.unwrap();

                    if n == 0 {
                        break;
                    }

                    socket.write_all(&b[..n]).await.unwrap();
                    pos += n as u64;

                    buf = b;
                }
            });
        }
    });
}
```

All tokio-uring operations are truly async, unlike APIs provided by `tokio::fs`,
which run on a thread pool. Using synchronous filesystem operations from a
thread pool adds significant overhead. With `io-uring`, we can perform both
network and file system operations asynchronously from the same thread. But,
io-uring is a lot more.

Tokio's current Linux implementation uses non-blocking system calls and epoll
for event notification. With epoll, a tuned TCP proxy will spend 70% to 80% of
CPU cycles outside of userspace, including cycles spent performing syscalls and
copying data between the kernel and userspace. Io-uring reduces overhead by
eliminating most syscalls and, for some operations, mapping memory regions used
for byte buffers ahead of time. Early benchmarks comparing io-uring against
epoll are promising; a TCP echo client and server implemented in C show up to
[60%
improvement](https://github.com/frevib/io_uring-echo-server/blob/master/benchmarks/benchmarks.md).

The initial tokio-uring release offers a modest set of APIs, but we plan on
adding support for all of io-uring’s capabilities over the coming releases. See
the [design document](https://github.com/tokio-rs/tokio-uring/pull/1) to get an
idea of where we are going.

So, give the crate a try and feel free to [ask questions
](https://github.com/tokio-rs/tokio-uring/discussions) or [report
issues](https://github.com/tokio-rs/tokio-uring/issues).

Also, we want to thank all who helped along the way, especially [Glauber
Costa](https://github.com/glommer) (Glommio author) who patiently answered many
of my questions, [withoutboats](https://github.com/withoutboats) for the initial
exploration ([Ringbahn](https://github.com/ringbahn/ringbahn)) and spending time
talking through design issues with me, and
[quininer](https://github.com/quininer) for the excellent work on the pure Rust
io-uring [bindings](https://github.com/tokio-rs/io-uring).
