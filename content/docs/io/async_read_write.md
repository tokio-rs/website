---
title: "Using AsyncRead and AsyncWrite directly"
weight : 3030
menu:
  docs:
    parent: io
---

So far, we have primarily talked about `AsyncRead` and `AsyncWrite` in
the context of I/O combinators provided by Tokio. While these are [often
enough], sometimes you need to implement your own combinators that
want to perform asynchronous reads and writes directly.

# Reading data with `AsyncRead`

The heart of `AsyncRead` is the `poll_read` method. It maps the
`WouldBlock` error that indicates that an I/O operation would have
blocked into `NotReady`, which in turn lets us interoperate with the
world of futures. When you write a `Future` (or something like it, such
as `Stream`) that internally contains an `AsyncRead`, `poll_read` is
likely the method you will be interacting with.

The important thing to keep in mind with `poll_read` is that it follows
the same contract as `Future::poll`. Specifically, it cannot return
`NotReady` unless it has arranged for the current task to be notified
when it can make progress again. This fact is what lets us call
`poll_read` inside of `poll` in our own `Future`s; we know that we are
upholding the contract of `poll` when we forward a `NotReady` from
`poll_read`, because `poll_read` follows that same contract!

The exact mechanism Tokio uses to ensure that `poll_read` later notifies
the current task is out of scope for this section, but you can read more
about it in the [non-blocking I/O] section of Tokio internals if you're
interested.

With that all said, let's look at how we might implement the
[`read_exact`] method ourselves!

```rust,no_run
# extern crate tokio;
#[macro_use]
extern crate futures;
# fn main() {}
use std::{io, mem};
use tokio::prelude::*;

// This is going to be our Future.
// In the common case, this is set to Reading,
// but we'll set it to Empty when we return Async::Ready
// so that we can return the reader and the buffer.
enum ReadExact<R, T> {
    Reading {
        // This is the stream we're reading from.
        reader: R,
        // This is the buffer we're reading into.
        buffer: T,
        // And this is how far into the buffer we've written.
        pos: usize,
    },
    Empty,
}

// We want to be able to construct a ReadExact over anything
// that implements AsyncRead, and any buffer that can be
// thought of as a &mut [u8].
fn read_exact<R, T>(reader: R, buffer: T) -> ReadExact<R, T>
where
    R: AsyncRead,
    T: AsMut<[u8]>,
{
    ReadExact::Reading {
        reader,
        buffer,
        // Initially, we've read no bytes into buffer.
        pos: 0,
    }
}

impl<R, T> Future for ReadExact<R, T>
where
    R: AsyncRead,
    T: AsMut<[u8]>,
{
    // When we've filled up the buffer, we want to return both the buffer
    // with the data that we read and the reader itself.
    type Item = (R, T);
    type Error = io::Error;

    fn poll(&mut self) -> Poll<Self::Item, Self::Error> {
        match *self {
            ReadExact::Reading {
                ref mut reader,
                ref mut buffer,
                ref mut pos,
            } => {
                let buffer = buffer.as_mut();
                // Check that we haven't finished
                while *pos < buffer.len() {
                    // Try to read data into the remainder of the buffer.
                    // Just like read in std::io::Read, poll_read *can* read
                    // fewer bytes than the length of the buffer it is given,
                    // and we need to handle that by looking at its return
                    // value, which is the number of bytes actually read.
                    //
                    // Notice that we are using try_ready! here, so if poll_read
                    // returns NotReady (or an error), we will do the same!
                    // We uphold the contract that we have arranged to be
                    // notified later because poll_read follows that same
                    // contract, and _it_ returned NotReady.
                    let n = try_ready!(reader.poll_read(&mut buffer[*pos..]));
                    *pos += n;

                    // If no bytes were read, but there was no error, this
                    // generally implies that the reader will provide no more
                    // data (for example, because the TCP connection was closed
                    // by the other side).
                    if n == 0 {
                        return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "early eof"));
                    }
                }
            }
            ReadExact::Empty => panic!("poll a ReadExact after it's done"),
        }

        // We need to return the reader and the buffer, which we can only
        // do by moving them out of self. We do this by swapping our state
        // with an "empty" one. This _should_ be fine, because poll() requires
        // callers to not call poll() again after Ready has been returned,
        // so we should only ever see ReadExact::Reading when poll() is called.
        match mem::replace(self, ReadExact::Empty) {
            ReadExact::Reading { reader, buffer, .. } => Ok(Async::Ready((reader, buffer))),
            ReadExact::Empty => panic!(),
        }
    }
}
```

# Writing data with `AsyncWrite`

From doc-push plan:

```text
Dig into AsyncWrite trait.
    poll_write function
    poll_flush function.
    shutdown function
        In std, blocking cleanup ops are done in drop handler.
        shutdown performs this work, like flushing.
        Socket is safely dropped after shutdown returns Ok(Ready).
        Sometimes it isn't possible:
            Alternative: spawn task w/ socket to do cleanup work.
```

[often enough]: {{< ref "/docs/futures/combinators.md" >}}#when-to-use-combinators
[non-blocking I/O]: {{< ref "/docs/internals/net.md" >}}
[`read_exact`]: {{< api-url "tokio" >}}/io/fn.read_exact.html
