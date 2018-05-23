+++
title = "Working with framed streams"
description = "Understanding tokio helpers for framed streams"
menu = "going_deeper"
weight = 230
+++

Tokio has helpers to transform a stream of bytes into a stream frames. Examples
of byte streams include TCP connections, pipes, file objects and the standard
input and output file descriptors. In Rust, streams are easily identified
because they implement the `Read` and `Write` traits.

One of the simplest form of framed message is the line delimited message.
Each message ends with a `\n` character. Let's look at how one would implement
a stream of line delimited messages with tokio.

## Writing a codec

The codec implements the `tokio_io::codec::Decoder` and
`tokio_io::codec::Encoder` traits. Its job is to convert a frame to and from
bytes. Those traits are used in conjunction with the `tokio_io::codec::Framed`
struct to provide buffering, decoding and encoding of byte streams.

Let's look at a simplified version of the `LinesCodec` struct, which implements
decoding and encoding of the line delimited message.

```rust
pub struct LinesCodec {
    // Stored index of the next index to examine for a `\n` character.
    // This is used to optimize searching.
    // For example, if `decode` was called with `abc`, it would hold `3`,
    // because that is the next index to examine.
    // The next time `decode` is called with `abcde\n`, the method will
    // only look at `de\n` before returning.
    next_index: usize,
}
```

The comments here explain how, since the bytes are buffered until a line is
found, it is wasteful to search for a `\n` from the beginning of the buffer
everytime data is received. It's more efficient to keep the last length of
the buffer and start searching from there when new data is received.

The `Decoder::decode` method is called when data is received on the underlying
stream. The method can produce a frame or return `Ok(None)` to signify that
it needs more data to produce a frame. The `decode` method is responsible
for removing the data that no longer needs to be buffered by splitting it off
using the `BytesMut` methods. If the data is not removed, the buffer will
keep growing.

Let's look at how `Decoder::decode` is implemented for `LinesCodec`.

```rust
# extern crate bytes;
# extern crate tokio_io;
# use std::io;
# use std::str;
# use bytes::BytesMut;
# use tokio_io::codec::*;
# struct LinesCodec { next_index: usize };
# impl Decoder for LinesCodec {
#    type Item = String;
#    type Error = io::Error;
fn decode(&mut self, buf: &mut BytesMut) -> Result<Option<String>, io::Error> {
    // Look for a byte with the value '\n' in buf. Start searching from the search start index.
    if let Some(newline_offset) = buf[self.next_index..].iter().position(|b| *b == b'\n')
    {
        // Found a '\n' in the string.

        // The index of the '\n' is at the sum of the start position + the offset found.
        let newline_index = newline_offset + self.next_index;

        // Split the buffer at the index of the '\n' + 1 to include the '\n'.
        // `split_to` returns a new buffer with the contents up to the index.
        // The buffer on which `split_to` is called will now start at this index.
        let line = buf.split_to(newline_index + 1);

        // Trim the `\n` from the buffer because it's part of the protocol,
        // not the data.
        let line = &line[..line.len() - 1];

        // Convert the bytes to a string and panic if the bytes are not valid utf-8.
        let line = str::from_utf8(&line).expect("invalid utf8 data");

        // Set the search start index back to 0.
        self.next_index = 0;

        // Return Ok(Some(...)) to signal that a full frame has been produced.
        Ok(Some(line.to_string()))
    } else {
        // '\n' not found in the string.

        // Tell the next call to start searching after the current length of the buffer
        // since all of it was scanned and no '\n' was found.
        self.next_index = buf.len();

        // Ok(None) signifies that more data is needed to produce a full frame.
        Ok(None)
    }
}
# }
```

The `Encoder::encode` method is called when a frame must be written to the
underlying stream. The frame must be written to the buffer received as a
parameter. The data written to the buffer will be written to the
stream as it becomes ready to send the data.

Let's now look at how `Encoder::encode` is implemented for `LinesCodec`.

```rust
# extern crate bytes;
# extern crate tokio_io;
# use std::io;
# use std::str;
# use bytes::*;
# use tokio_io::codec::*;
# struct LinesCodec { next_index: usize };
# impl Encoder for LinesCodec {
#    type Item = String;
#    type Error = io::Error;
fn encode(&mut self, line: String, buf: &mut BytesMut) -> Result<(), io::Error> {
    // It's important to reserve the amount of space needed. The `bytes` API
    // does not grow the buffers implicitly.
    // Reserve the length of the string + 1 for the '\n'.
    buf.reserve(line.len() + 1);

    // String implements IntoBuf, a trait used by the `bytes` API to work with
    // types that can be expressed as a sequence of bytes.
    buf.put(line);

    // Put the '\n' in the buffer.
    buf.put_u8(b'\n');

    // Return ok to signal that no error occured.
    Ok(())
}
# }
```

It's often simpler to encode information. Here we simply reserve the space
needed and write the data to the buffer.

## Using a codec
The simplest way of using a codec is with the `Framed` struct. It's a wrapper
around a codec that implements automatic buffering. The `Framed` struct is both
a `Stream` and a `Sink`. Thus, you can receive frames from it and send frames
to it.

You can create a `Framed` struct using any type that implement the `AsyncRead`
and `AsyncWrite` traits using the `AsyncRead::framed` method.

```rust
# extern crate futures;
# extern crate tokio;
# extern crate tokio_io;
# use futures::prelude::*;
# use tokio::net::TcpStream;
# use tokio_io::AsyncRead;
# use tokio_io::codec::LinesCodec;
# let addr = "127.0.0.1:5000".parse().expect("invalid socket address");
TcpStream::connect(&addr).and_then(|sock| {
    let framed_sock = sock.framed(LinesCodec::new());
    framed_sock.for_each(|line| {
        println!("Received line {}", line);
        Ok(())
    })
});
```
