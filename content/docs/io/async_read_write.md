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
`WouldBlock` error that indicates that an I/O `read` operation would
have blocked into `NotReady`, which in turn lets us interoperate with
the world of futures. When you write a `Future` (or something like it,
such as `Stream`) that internally contains an `AsyncRead`, `poll_read`
is likely the method you will be interacting with.

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

Just like `poll_read` is the core piece of `AsyncRead`, `poll_write` is
the core of `AsyncWrite`. Like `poll_read`, it maps the `WouldBlock`
error that indicates that an I/O *`write`* operation would have blocked into
`NotReady`, which again lets us interoperate with the world of
futures. `AsyncWrite` also has a `poll_flush`, which provides an
asynchronous analogue to [`Write`]'s `flush` method. The role of
`poll_flush` is to make sure that any bytes previously written by
`poll_write` are, well, flushed onto the underlying I/O resource
(written out in network packets for example). Similar to `poll_write`, it
wraps around `Write::flush`, and maps a `WouldBlock` error into
`NotReady` to indicate that the flushing is still ongoing.

`AsyncWrite`'s `poll_write` and `poll_flush` follow the same contract as
`Future::poll` and `AsyncRead::poll_read`, namely that if they return
`NotReady`, they have arranged for the current task to be notified when
they can make progress again. Like with `poll_read`, this means that we
can safely call these methods in our own futures, and know that we are
also following the contract.

Tokio uses the same mechanism to manage notifications for `poll_write`
and `poll_flush` as it does for `poll_read`, and you can read more about
it in the [non-blocking I/O] section of Tokio internals.

## Shutdown

`AsyncWrite` also adds one method that is *not* part of `Write`:
`shutdown`. From [its documentation][shutdown]:

> Initiates or attempts to shut down this writer, returning success when
> the I/O connection has completely shut down.
>
> This method is intended to be used for asynchronous shutdown of I/O
> connections. For example this is suitable for implementing shutdown of
> a TLS connection or calling `TcpStream::shutdown` on a proxied
> connection. Protocols sometimes need to flush out final pieces of data
> or otherwise perform a graceful shutdown handshake, reading/writing
> more data as appropriate. This method is the hook for such protocols
> to implement the graceful shutdown logic.

This sums `shutdown` up pretty nicely: it is a way to tell the writer
that no more data is coming, and that it should indicate in whatever way
the underlying I/O protocol requires. For TCP connections, for example,
this usually entails closing the writing side of the TCP channel so that
the other end receives and end-of-file in the form of a read that
returns 0 bytes. You can often think of `shutdown` as what you _would_
have done synchronously in the implementation of `Drop`; it's just that
in the asynchronous world, you can't easily do something in `Drop`
because you need to have an executor that keeps polling your writer!

<!--
Socket is safely dropped after shutdown returns Ok(Ready).
Sometimes it isn't possible:
    Alternative: spawn task w/ socket to do cleanup work.
-->

Note that calling `shutdown` on a write "half" of a type that implements
`AsyncWrite` *and* `AsyncRead` does not shut down the read "half". You
can usually still continue reading data as you please until the other
side shuts down their corresponding write "half".

## An example of using `AsyncWrite`

Without further ado, let's take a look at how we might implement
[`write_all`]:


```rust,no_run
# extern crate tokio;
#[macro_use]
extern crate futures;
# fn main() {}
use std::{io, mem};
use tokio::prelude::*;

// This is going to be our Future.
// It'll seem awfully familiar to ReadExact above!
// In the common case, this is set to Writing,
// but we'll set it to Empty when we return Async::Ready
// so that we can return the writer and the buffer.
enum WriteAll<W, T> {
    Writing {
        // This is the stream we're writing into.
        writer: W,
        // This is the buffer we're writing from.
        buffer: T,
        // And this is much of the buffer we've written.
        pos: usize,
    },
    Empty,
}

// We want to be able to construct a WriteAll over anything
// that implements AsyncWrite, and any buffer that can be
// thought of as a &[u8].
fn write_all<W, T>(writer: W, buffer: T) -> WriteAll<W, T>
where
    W: AsyncWrite,
    T: AsRef<[u8]>,
{
    WriteAll::Writing {
        writer,
        buffer,
        // Initially, we've written none of the bytes from buffer.
        pos: 0,
    }
}

impl<W, T> Future for WriteAll<W, T>
where
    W: AsyncWrite,
    T: AsRef<[u8]>,
{
    // When we've written out the entire buffer, we want to return
    // both the buffer and the writer so that the user can re-use them.
    type Item = (W, T);
    type Error = io::Error;

    fn poll(&mut self) -> Poll<Self::Item, Self::Error> {
        match *self {
            WriteAll::Writing {
                ref mut writer,
                ref buffer,
                ref mut pos,
            } => {
                let buffer = buffer.as_ref();
                // Check that we haven't finished
                while *pos < buffer.len() {
                    // Try to write the remainder of the buffer into the writer.
                    // Just like write in std::io::Write, poll_write *can* write
                    // fewer bytes than the length of the buffer it is given,
                    // and we need to handle that by looking at its return
                    // value, which is the number of bytes actually written.
                    //
                    // We are using try_ready! here, just like in poll_read in
                    // ReadExact, so that if poll_write returns NotReady (or an
                    // error), we will do the same! We uphold the contract that
                    // we have arranged to be notified later because poll_write
                    // follows that same contract, and _it_ returned NotReady.
                    let n = try_ready!(writer.poll_write(&buffer[*pos..]));
                    *pos += n;

                    // If no bytes were written, but there was no error, this
                    // generally implies that something weird happened under us.
                    // We make sure to turn this into an error for the caller to
                    // deal with.
                    if n == 0 {
                        return Err(io::Error::new(
                            io::ErrorKind::WriteZero,
                            "zero-length write",
                        ));
                    }
                }
            }
            WriteAll::Empty => panic!("poll a WriteAll after it's done"),
        }

        // We use the same trick as in ReadExact to ensure that we can return
        // the buffer and the writer once the entire buffer has been written out.
        match mem::replace(self, WriteAll::Empty) {
            WriteAll::Writing { writer, buffer, .. } => Ok((writer, buffer).into()),
            WriteAll::Empty => panic!(),
        }
    }
}
```

[often enough]: {{< ref "/docs/futures/combinators.md" >}}#when-to-use-combinators
[shutdown]: {{< api-url "tokio-io" >}}/trait.AsyncWrite.html#tymethod.shutdown
[non-blocking I/O]: {{< ref "/docs/internals/net.md" >}}
[`read_exact`]: {{< api-url "tokio" >}}/io/fn.read_exact.html
[`write_all`]: {{< api-url "tokio" >}}/io/fn.write_all.html
[`Write`]: https://doc.rust-lang.org/std/io/trait.Write.html
