---
title: "Unit Testing"
---

The purpose of this page is to give advice on how to write useful unit tests in
asynchronous applications.

## Pausing and resuming time in tests

Sometimes, asynchronous code explicitly waits by calling [`tokio::time::sleep`]
or waiting on a [`tokio::time::Interval::tick`]. Testing behaviour based on
time (for example, an exponential backoff) can get cumbersome when the unit
test starts running very slowly. However, internally, the time-related
functionality of tokio supports pausing and resuming time. Pausing time has the
effect that any time-related future may become ready early. The condition for
the time-related future resolving early is that there are no more other futures
which may become ready. This essentially fast-forwards time when the only
future being awaited is time-related:

```rust
#[tokio::test]
async fn paused_time() {
    tokio::time::pause();
    let start = std::time::Instant::now();
    tokio::time::sleep(Duration::from_millis(500)).await;
    println!("{:?}ms", start.elapsed().as_millis());
}
```

This code prints `0ms` on a reasonable machine.

For unit tests, it is often useful to run with paused time throughout. This can
be achieved simply by setting the macro argument `start_paused` to `true`:

```rust
#[tokio::test(start_paused = true)]
async fn paused_time() {
    let start = std::time::Instant::now();
    tokio::time::sleep(Duration::from_millis(500)).await;
    println!("{:?}ms", start.elapsed().as_millis());
}
```

See [tokio::test "Configure the runtime to start with time paused"](https://docs.rs/tokio/latest/tokio/attr.test.html#configure-the-runtime-to-start-with-time-paused) for more details.

Of course, the temporal order of future resolution is maintained, even when
using different time-related futures:

```rust
#[tokio::test(start_paused = true)]
async fn interval_with_paused_time() {
    let mut interval = interval(Duration::from_millis(300));
    let _ = timeout(Duration::from_secs(1), async move {
        loop {
            interval.tick().await;
            println!("Tick!");
        }
    })
    .await;
}
```

This code immediately prints `"Tick!"` exactly 4 times.

[`tokio::time::Interval::tick`]: https://docs.rs/tokio/1/tokio/time/struct.Interval.html#method.tick
[`tokio::time::sleep`]: https://docs.rs/tokio/1/tokio/time/fn.sleep.html

## Mocking using [`AsyncRead`] and [`AsyncWrite`]

The generic traits for reading and writing asynchronously ([`AsyncRead`] and
[`AsyncWrite`]) are implemented by, for example, sockets. They can be used for
mocking I/O performed by a socket.

Consider, for setup, this simple TCP server loop:

```rust
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    # if true { return }
    let listener = TcpListener::bind("127.0.0.1:8080").await.unwrap();
    loop {
        let Ok((mut socket, _)) = listener.accept().await else {
            eprintln!("Failed to accept client");
            continue;
        };

        tokio::spawn(async move {
            let (reader, writer) = socket.split();
            // Run some client connection handler, for example:
            // handle_connection(reader, writer)
                // .await
                // .expect("Failed to handle connection");
        });
    }
}
```

Here, each TCP client connection is serviced by its dedicated tokio task. This
task owns a reader and a writer, which are [`split`] off of a [`TcpStream`].

Consider now the actual client handler task, especially the `where`-clause of the
function signature:

```rust
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};

async fn handle_connection<Reader, Writer>(
    reader: Reader,
    mut writer: Writer,
) -> std::io::Result<()>
where
    Reader: AsyncRead + Unpin,
    Writer: AsyncWrite + Unpin,
{
    let mut line = String::new();
    let mut reader = BufReader::new(reader);

    loop {
        if let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break Ok(());
            }
            writer
                .write_all(format!("Thanks for your message.\r\n").as_bytes())
                .await
                .unwrap();
        }
        line.clear();
    }
}
```

Essentially, the given reader and writer, which implement [`AsyncRead`] and
[`AsyncWrite`], are serviced sequentially. For each received line, the handler
replies with `"Thanks for your message."`.

To unit test the client connection handler, a [`tokio_test::io::Builder`] can
be used as a mock:

```rust
# use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
# 
# async fn handle_connection<Reader, Writer>(
#     reader: Reader,
#     mut writer: Writer,
# ) -> std::io::Result<()>
# where
#     Reader: AsyncRead + Unpin,
#     Writer: AsyncWrite + Unpin,
# {
#     let mut line = String::new();
#     let mut reader = BufReader::new(reader);
#
#     loop {
#         if let Ok(bytes_read) = reader.read_line(&mut line).await {
#             if bytes_read == 0 {
#                 break Ok(());
#             }
#             writer
#                 .write_all(format!("Thanks for your message.\r\n").as_bytes())
#                 .await
#                 .unwrap();
#         }
#         line.clear();
#     }
# }
#
#[tokio::test]
async fn client_handler_replies_politely() {
    let reader = tokio_test::io::Builder::new()
        .read(b"Hi there\r\n")
        .read(b"How are you doing?\r\n")
        .build();
    let writer = tokio_test::io::Builder::new()
        .write(b"Thanks for your message.\r\n")
        .write(b"Thanks for your message.\r\n")
        .build();
    let _ = handle_connection(reader, writer).await;
}
```

[`AsyncRead`]: https://docs.rs/tokio/latest/tokio/io/trait.AsyncRead.html
[`AsyncWrite`]: https://docs.rs/tokio/latest/tokio/io/trait.AsyncWrite.html
[`split`]: https://docs.rs/tokio/latest/tokio/net/struct.TcpStream.html#method.split
[`TcpStream`]: https://docs.rs/tokio/latest/tokio/net/struct.TcpStream.html
[`tokio_test::io::Builder`]: https://docs.rs/tokio-test/latest/tokio_test/io/struct.Builder.html
