---
title: "Reading and Writing Data"
weight : 3020
menu:
  docs:
    parent: io
---



# Non-blocking I/O

In [the overview] we mentioned briefly that Tokio's I/O types implement
non-blocking variants of `std::io::Read` and `std::io::Write` called
[`AsyncRead`] and [`AsyncWrite`]. These are an integral part of Tokio's
I/O story, and are important to understand when working with I/O code.

> Note: in this section, we'll primarily talk about `AsyncRead`, but
> `AsyncWrite` is pretty much exactly the same, just for writing data to
> an I/O resource (like a TCP socket) instead of reading from it.

So, let's take a look at [`AsyncRead`] and see what all the fuss is
about:

```rust,no_run
use std::io::Read;
pub trait AsyncRead: Read {
    // ...
    // various provided methods
    // ...
}
```

Huh. What's going on here? Well, `AsyncRead` is really just [`Read`]
from `std::io`, along with an additional _contract_. The documentation
for `AsyncRead` reads:

> This trait inherits from `std::io::Read` and indicates that an I/O
> object is non-blocking. **All non-blocking I/O objects must return an
> error when bytes are unavailable instead of blocking the current
> thread.**

That last part is critical. If you implement `AsyncRead` for a type, you
are _promising_ that calling `read` on it will _never_ block. Instead,
you are expected to return an `io::ErrorKind::WouldBlock` error to
indicate that the operation _would_ have blocked (for example because
there was no more data available) if it wasn't non-blocking. The
provided `poll_read` method relies on this:

```rust,ignore
fn poll_read(&mut self, buf: &mut [u8]) -> Poll<usize, std::io::Error> {
    match self.read(buf) {
        Ok(t) => Ok(Async::Ready(t)),
        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
            Ok(Async::NotReady)
        }
        Err(e) => Err(e),
    }
}
```

This code should look familiar. If you squint a little, `poll_read`
looks a lot like `Future::poll`. And that's because that's almost
exactly what it is! A type that implements `AsyncRead` essentially
behaves like a future that you can try to read data out of, and it will
inform you whether it is `Ready` (and some data was read) or `NotReady`
(and you'll have to `poll_read` again later).


# Working with I/O futures

Since `AsyncRead` (and `AsyncWrite`) are pretty much futures, you can
easily embed them in your own futures and `poll_read` them just as you
would `poll` any other embedded `Future`. You can even use `try_ready!`
to propagate errors and `NotReady` as appropriate. We'll talk more about
directly using these traits in [the next section]. However, to make life
simpler in a number of situations, Tokio provides a number of useful
combinators in [`tokio::io`] for performing common I/O operations on top
of `AsyncRead` and `AsyncWrite`. In general, these provide wrappers
around `AsyncRead` or `AsyncWrite` types that implement `Future` and
that complete when a given read or write operation has completed.

The first handy I/O combinator is [`read_exact`]. It takes a mutable
buffer (`&mut [u8]`) and an implementor of `AsyncRead` as arguments, and
returns a `Future` that reads exactly enough bytes to fill the buffer.
Internally the returned future just keeps track of how many bytes it has
read thus far, and continues to issue `poll_ready` on the `AsyncRead`
(returning `NotReady` if necessary) until it has exactly filled the
buffer. At that point, it returns `Ready(buf)` with the filled buffer.
Let's take a look:

```rust,no_run
# extern crate tokio;
use tokio::net::tcp::TcpStream;
use tokio::prelude::*;

# fn main() {
let addr = "127.0.0.1:12345".parse().unwrap();
let read_8_fut = TcpStream::connect(&addr)
    .and_then(|stream| {
        // We need to create a buffer for read_exact to write into.
        // A Vec<u8> is a good starting point.
        // read_exact will read buffer.len() bytes, so we need
        // to make sure the Vec isn't empty!
        let mut buf = vec![0; 8];

        // read_exact returns a Future that resolves when
        // buffer.len() bytes have been read from stream.
        tokio::io::read_exact(stream, buf)
    })
    .inspect(|(_stream, buf)| {
        // Notice that we get both the buffer and the stream back
        // here, so that we can now continue using the stream to
        // send a reply for example.
        println!("got eight bytes: {:x?}", buf);
    });

// We can now either chain more futures onto read_8_fut,
// or if all we wanted to do was read and print those 8
// bytes, we can just use tokio::run to run it (taking
// care to map Future::Item and Future::Error to ()).
# }
```

A second I/O combinator that is often useful is [`write_all`]. It takes
a buffer (`&[u8]`) and an implementor of `AsyncWrite` as arguments, and
returns a `Future` that writes out all the bytes of the buffer into the
`AsyncWrite` using `poll_write`. When the `Future` resolves, the entire
buffer has been written out and flushed. We can combine this with
[`read_exact`] to echo whatever the server says back to it:

```rust,no_run
# extern crate tokio;
use tokio::net::tcp::TcpStream;
use tokio::prelude::*;

# fn main() {
# let addr = "127.0.0.1:12345".parse().unwrap();
let echo_fut = TcpStream::connect(&addr)
    .and_then(|stream| {
        // We're going to read the first 32 bytes the server sends us
        // and then just echo them back:
        let mut buf = vec![0; 32];
        // First, we need to read the server's message
        tokio::io::read_exact(stream, buf)
    })
    .and_then(|(stream, buf)| {
        // Then, we use write_all to write the entire buffer back:
        tokio::io::write_all(stream, buf)
    })
    .inspect(|(_stream, buf)| {
        println!("echoed back {} bytes: {:x?}", buf.len(), buf);
    });

// As before, we can chain more futures onto echo_fut,
// or declare ourselves finished and run it with tokio::run.
# }
```

Tokio also comes with an I/O combinator to implement this kind of
copying. It is (perhaps unsurprisingly) called [`copy`]. [`copy`] takes
an `AsyncRead` and an `AsyncWrite`, and continuously writes all the
bytes read out from the `AsyncRead` into the `AsyncWrite` until
`poll_read` indicates that the input has been closed and all the bytes
have been written out and flushed to the output. This is the combinator
we used in our [echo server]! It greatly simplifies our example from
above, and also makes it work for _any_ amount of server data!

```rust,no_run
# extern crate tokio;
use tokio::net::tcp::TcpStream;
use tokio::prelude::*;

# fn main() {
# let addr = "127.0.0.1:12345".parse().unwrap();
let echo_fut = TcpStream::connect(&addr)
    .and_then(|stream| {
        // First, we need to get a separate read and write handle for
        // the connection so that we can forward one to the other.
        // See "Split I/O resources" below for more details.
        let (reader, writer) = stream.split();
        // Then, we can use copy to send all the read bytes to the
        // writer, and return how many bytes it read/wrote.
        tokio::io::copy(reader, writer)
    })
    .inspect(|(bytes_copied, r, w)| {
        println!("echoed back {} bytes", bytes_copied);
    });
# }
```

Pretty neat!

The combinators we've talked about so far are all for pretty low-level
operations: read these bytes, write these bytes, copy these bytes. Often
times though, you want to operate on higher-level representations, like
"lines". Tokio has you covered there too! [`lines`] takes an
`AsyncRead`, and returns a `Stream` that yields each line from the input
until there are no more lines to read:

```rust,no_run
# extern crate tokio;
use tokio::net::tcp::TcpStream;
use tokio::prelude::*;

# fn main() {
# let addr = "127.0.0.1:12345".parse().unwrap();
let lines_fut = TcpStream::connect(&addr).and_then(|stream| {
    // We want to parse out each line we receive on stream.
    // To do that, we may need to buffer input for a little while
    // (if the server sends two lines in one packet for example).
    // Because of that, lines requires that the AsyncRead it is
    // given *also* implements BufRead. This may be familiar if
    // you've ever used the lines() method from std::io::BufRead.
    // Luckily, BufReader from the standard library gives us that!
    let stream = std::io::BufReader::new(stream);
    tokio::io::lines(stream).for_each(|line| {
        println!("server sent us the line: {}", line);
        // This closure is called for each line we receive,
        // and returns a Future that represents the work we
        // want to do before accepting the next line.
        // In this case, we just wanted to print, so we
        // don't need to do anything more.
        Ok(())
    })
});
# }
```

There are also plenty more I/O combinators in [`tokio::io`] that you may
want to take a look at before you decide to write your own!

# Split I/O resources

Both the [`copy`] example above and the [echo server] contained this
mysterious-looking snippet:

```rust,ignore
let (reader, writer) = socket.split();
let bytes_copied = tokio::io::copy(reader, writer);
```

As the comment above it explains, we split the `TcpStream` (`socket`)
into a read "half" and a write "half", and use the [`copy`] combinator
we discussed above to produce a `Future` that asynchronously copies  all
the data from the read half to the write half. But why is this "split"
required in the first place? After all, `AsyncRead::poll_ready` and
`AsyncWrite::poll_write` just take `&mut self`.

To answer that, we need to think back to Rust's ownership system a
little. Recall that Rust only allows you to have a _single_ mutable
reference to a given variable at a time. But we have to pass _two_
arguments to [`copy`], one for where to read from, and one for where to
write to. However, once we pass a mutable reference to the `TcpStream`
as one of the arguments, we cannot also construct a second mutable
reference to it to pass as the second argument! *We* know that [`copy`]
won't read and write _at the same time_ to those, but that's not
expressed in `copy`'s types.

Enter [`split`], a provided method on the `AsyncRead` trait when the
type *also* implements `AsyncWrite`. If we look at the signature, we see

```rust,ignore
fn split(self) -> (ReadHalf<Self>, WriteHalf<Self>)
  where Self: AsyncWrite { ... }
```

The returned `ReadHalf` implements `AsyncRead`, and the `WriteHalf`
implements `AsyncWrite`. And crucially, we now have two *separate*
pointers into our type, which we can pass around separately. This comes
in handy for [`copy`], but it also means that we can pass each half to
a different future, and handle the reads and writes completely
independently! Behind the scenes, [`split`] ensures that if we both try
to read and write at the same time, only one of them happen at a time.

# Transports

Turning an `AsyncRead` into a `Stream` (like [`lines`] does) or an
`AsyncWrite` into a `Sink` is pretty common in applications that need to
do I/O. They often want to abstract away the way bytes are retrieved
from or put on the wire, and let most of their application code deal
with more convenient "requests" and "response" types. This is often
known as "framing": instead of viewing your connections as consisting of
just bytes in/bytes out, you view them as "frames" of application data
that are received and sent. A framed stream of bytes is often referred
to as a "transport".

Transports are typically implemented using a _codec_. For example,
[`lines`] represents a very simple codec that separates a byte string by
the newline character, `\n`, and parses each frame as a string before
passing it to the application. Tokio provides helpers for implementing
new codecs in [`tokio::codec`]; you implement the [`Encoder`] and
[`Decoder`] traits for your transport, and use [`Framed::new`] to make
a `Sink + Stream` from your byte stream (like a `TcpStream`). It's
almost like magic! There are versions for doing just the read or write
side of a codec too (like [`lines`]). Let's take a look at writing a
simple implementation of a line-based codec (even though [`LinesCodec`]
exists):

```rust
# extern crate tokio;
extern crate bytes;
use bytes::{BufMut, BytesMut};
use tokio::codec::{Decoder, Encoder};
use tokio::prelude::*;

// This is where we'd keep track of any extra book-keeping information
// our transport needs to operate.
struct LinesCodec;

// Turns string errors into std::io::Error
fn bad_utf8<E>(_: E) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, "Unable to decode input as UTF8")
}

// First, we implement encoding, because it's so straightforward.
// Just write out the bytes of the string followed by a newline!
// Easy-peasy.
impl Encoder for LinesCodec {
    type Item = String;
    type Error = std::io::Error;

    fn encode(&mut self, line: Self::Item, buf: &mut BytesMut) -> Result<(), Self::Error> {
        // Note that we're given a BytesMut here to write into.
        // BytesMut comes from the bytes crate, and aims to give
        // efficient read/write access to a buffer. To use it,
        // we have to reserve memory before we try to write to it.
        buf.reserve(line.len() + 1);
        // And now, we write out our stuff!
        buf.put(line);
        buf.put_u8(b'\n');
        Ok(())
    }
}

// The decoding is a little trickier, because we need to look for
// newline characters. We also need to handle *two* cases: the "normal"
// case where we're just asked to find the next string in a bunch of
// bytes, and the "end" case where the input has ended, and we need
// to find any remaining strings (the last of which may not end with a
// newline!
impl Decoder for LinesCodec {
    type Item = String;
    type Error = std::io::Error;

    // Find the next line in buf!
    fn decode(&mut self, buf: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        Ok(if let Some(offset) = buf.iter().position(|b| *b == b'\n') {
            // We found a newline character in this buffer!
            // Cut out the line from the buffer so we don't return it again.
            let mut line = buf.split_to(offset + 1);
            // And then parse it as UTF-8
            Some(
                std::str::from_utf8(&line[..line.len() - 1])
                    .map_err(bad_utf8)?
                    .to_string(),
            )
        } else {
            // There are no newlines in this buffer, so no lines to speak of.
            // Tokio will make sure to call this again when we have more bytes.
            None
        })
    }

    // Find the next line in buf when there will be no more data coming.
    fn decode_eof(&mut self, buf: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        Ok(match self.decode(buf)? {
            Some(frame) => {
                // There's a regular line here, so we may as well just return that.
                Some(frame)
            },
            None => {
                // There are no more lines in buf!
                // We know there are no more bytes coming though,
                // so we just return the remainder, if any.
                if buf.is_empty() {
                    None
                } else {
                    Some(
                        std::str::from_utf8(&buf.take()[..])
                            .map_err(bad_utf8)?
                            .to_string(),
                    )
                }
            }
        })
    }
}
```

[the overview]: {{< ref "/docs/io/overview.md" >}}
[the next section]: {{< ref "/docs/io/async_read_write.md" >}}
[echo server]: {{< ref "/docs/io/overview.md" >}}#an-example-server
[`Read`]: https://doc.rust-lang.org/std/io/trait.Read.html
[`AsyncRead`]: {{< api-url "tokio-io" >}}/trait.AsyncRead.html
[`split`]: {{< api-url "tokio-io" >}}/trait.AsyncRead.html##method.split
[`AsyncWrite`]: {{< api-url "tokio-io" >}}/trait.AsyncWrite.html
[`tokio::io`]: {{< api-url "tokio" >}}/io/index.html
[`tokio::codec`]: {{< api-url "tokio" >}}/codec/index.html
[`Decoder`]: {{< api-url "tokio" >}}/codec/trait.Decoder.html
[`Encoder`]: {{< api-url "tokio" >}}/codec/trait.Encoder.html
[`Framed::new`]: {{< api-url "tokio" >}}/codec/struct.Framed.html#method.new
[`LinesCodec`]: {{< api-url "tokio" >}}/codec/struct.LinesCodec.html
[`read_exact`]: {{< api-url "tokio" >}}/io/fn.read_exact.html
[`write_all`]: {{< api-url "tokio" >}}/io/fn.write_all.html
[`copy`]: {{< api-url "tokio" >}}/io/fn.copy.html
[`lines`]: {{< api-url "tokio" >}}/io/fn.lines.html
