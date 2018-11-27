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

Huh. What's going on here? Well, `AsyncRead` is really just `Read` from
`std::io`, along with an additional _contract_. The documentation for
`AsyncRead` reads:

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
to propagate errors and `NotReady` as appropriate. However, to make life
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

A second I/O combinator that is often useful is [`write_all`]. It takes
a buffer (`&[u8]`) and an implementor of `AsyncWrite` as arguments, and
returns a `Future` that writes out all the bytes of the buffer into the
`AsyncWrite` using `poll_write`. When the `Future` resolves, the entire
buffer has been written out and flushed.

[`copy`] takes an `AsyncRead` and an `AsyncWrite`, and continuously
writes all the bytes read out from the `AsyncRead` into the `AsyncWrite`
until `poll_read` indicates that the input has been closed and all the
bytes have been written out and flushed to the output. This is the
combinator we used in our [echo server] in the previous section!

Finally, [`lines`] takes an `AsyncRead`, and returns a `Stream` that
yields each line from the input until there are no more lines to read.

There are also plenty more I/O combinators in [`tokio::io`] that you may
want to take a look at before you decide to write your own!

# Split I/O resources

The [echo server] contained this mysterious-looking snippet:

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

[the overview]: {{< ref "/docs/io/overview.md" >}}
[echo server]: {{< ref "/docs/io/overview.md" >}}#an-example-server
[`AsyncRead`]: {{< api-url "tokio-io" >}}/trait.AsyncRead.html
[`split`]: {{< api-url "tokio-io" >}}/trait.AsyncRead.html##method.split
[`AsyncWrite`]: {{< api-url "tokio-io" >}}/trait.AsyncWrite.html
[`tokio::io`]: {{< api-url "tokio" >}}/io/index.html
[`read_exact`]: {{< api-url "tokio" >}}/io/fn.read_exact.html
[`write_all`]: {{< api-url "tokio" >}}/io/fn.write_all.html
[`copy`]: {{< api-url "tokio" >}}/io/fn.copy.html
[`lines`]: {{< api-url "tokio" >}}/io/fn.lines.html
