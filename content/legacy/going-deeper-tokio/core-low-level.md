+++
title = "Low-level I/O using core"
description = ""
+++

We've seen some examples of [high level I/O]({{< relref "core.md" >}}) with
[`tokio-core`], but these aren't quite always flexible enough to work with all
flavors of futures.  Often times the particulars of buffering strategy,
ownership, etc, may want to be tweaked.

Here we'll explore the low-level support that [`tokio-core`] provides as well as
how it expects I/O objects to work. This should be helpful if you're
implementing your own I/O object or writing your own implementation of [`Future`]
that internally performs I/O.

[`Future`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html
[`tokio-core`]: https://github.com/tokio-rs/tokio-core

## [I/O patterns](#io-patterns) {#io-patterns}

All I/O with [`tokio-core`] consistently adheres to two properties:

* Operations are non-blocking. If an operation would otherwise block an error of
  the `WouldBlock` [error kind] is returned.
* When a `WouldBlock` error is returned, the current future task is scheduled to
  receive a notification when the I/O object would otherwise be ready.

[error kind]: https://doc.rust-lang.org/std/io/enum.ErrorKind.html

Let's take a look at some concrete examples with [`TcpStream`]. The lowest level
of I/O that TCP streams support is the [`Read`] and [`Write`] traits from the
standard library. Sure enough, we see a number of trait implementations for
[`TcpStream`]:

[`TcpStream`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.TcpStream.html
[`Read`]: https://doc.rust-lang.org/std/io/trait.Read.html
[`Write`]: https://doc.rust-lang.org/std/io/trait.Write.html

```rust,ignore
impl Read for TcpStream
impl Write for TcpStream
impl<'a> Read for &'a TcpStream
impl<'a> Write for &'a TcpStream
```

In accordance with the two properties mentioned above, these implementations are
quite different than their standard library counterparts. They are all
*non-blocking*; rather than blocking the current thread for data to arrive or
for there to be room to write, they will return `WouldBlock`.

The second property though is a little more subtle. It transitively implies
that **all Tokio I/O objects can only be used within the context of a task**,
which generally means within `poll`-like methods. (This task context is tracked
implicitly using thread-local storage; see the [section on tasks]({{< relref "tasks.md" >}})
for more detail.) With this property, though, we can get ergonomic and efficient
management of "blocking" the current *task* waiting for I/O to complete. In
other words, we get a lightweight threading model.

Recall in the [futures model]({{< relref "futures-model.md" >}}) section we
learned that whenever a future returns `NotReady` it will schedule the current
task to receive a notification when it would otherwise become ready. Basic I/O
operations in Tokio work in a similar way. For example:

```rust,ignore
let mut buf = [0; 128];
let res = tcp_stream.read(&mut buf);
```

Here we're just reading data from a TCP stream into a stack local buffer. We're
guaranteed that `read` will return immediately, and it can return with one of
three values:

* `Ok(n)` where `n` bytes were successfully read from the stream into `buf`.
  This means that data was immediately available and we didn't have to block
  waiting for it. We can now proceed with the data we've read and process it as
  usual.

* `Err(e) if e.kind() == ErrorKind::WouldBlock` meaning that the operation did
  not fail per se but otherwise could not complete. This error indicates that
  there may eventually be more data to read but it's not available at this time.
  Like with a future returning `NotReady`, this also means that the current task
  has been scheduled for wakeup when data is ready. When the `tcp_stream`
  receives some more data, the task will be woken up and the outer future can
  resume.

* `Err(e)` means that an otherwise "real" I/O error happened. This typically
  should be communicated up the stack to indicate that a potentially fatal error
  on the TCP connection has occurred.

Although we've been talking about the [`Read`] and [`Write`] traits so far these
two principles of non-blocking and "futures aware" apply to all I/O that
[`tokio-core`] performs. This includes other examples such as accepting TCP
sockets from a listener or sending a datagram on a UDP socket.

## [`AsyncRead` and `AsyncWrite`](#async-read-write) {#async-read-write}

While some implementations of `Read` and `Write` provide the required properties
described above, not all do. For example, none of the file I/O operations in std
will work on the event loop even though they implement `Read` and `Write`.
However, `tokio-io` provides [`AsyncRead`] and [`AsyncWrite`] traits which
extend `Read` and `Write` respectively. Implementations of these traits
guarantee that they satisfy the required properties to work with the event loop.

So, looking at `tokio_core::net::TcpStream` again, you will also see:

```rust,ignore
impl AsyncRead for TcpStream
impl AsyncWrite for TcpStream
```

Besides just indicating that they work with the event loop, they also provide a
number of additional helper functions, some of which we have seen before. See
the full [API documentation] for more details.

[`AsyncRead`]: https://docs.rs/tokio-io/0.1/tokio_io/trait.AsyncRead.html
[`AsyncWrite`]: https://docs.rs/tokio-io/0.1/tokio_io/trait.AsyncWrite.html
[API documentation]: https://docs.rs/tokio-io/0.1/tokio_io/

## [Buffering strategies](#buffering) {#buffering}

The core types in [`tokio-core`] do not bake in any particular buffering
strategy and should be amenable to working with whatever's appropriate for your
application. All methods that read and write bytes work over slices which can be
used to get as close to the raw syscalls as possible. There are also `read_buf`
and `write_buf` functions which are generic over [`Buf`] and [`BufMut`],
allowing for various buffering strategies to interopt.

Further buffering strategies can be found in the [`bytes`] crate on [crates.io]
which should compose well with the slice-taking methods of [`tokio-core`]. Note
that all methods that read bytes in [`tokio-core`] are guaranteed to not attempt
to read the slice of data passed in and will accurately report sizes read. As a
result it should be safe to pass slices of uninitialized data to read methods if
necessary.

[`bytes`]: https://github.com/carllerche/bytes
[crates.io]: https://crates.io
[`Buf`]: https://docs.rs/bytes/0.4/bytes/trait.Buf.html
[`BufMut`]: https://docs.rs/bytes/0.4/bytes/trait.BufMut.html

## [Creating your own I/O object](#custom-io) {#custom-io}

Currently [`tokio-core`] only provides three standard networking types available
on all platforms: [`UdpSocket`], [`TcpListener`], and [`TcpStream`]. While
encompassing a wide range of use cases these aren't the only objects that can
work with async I/O! A final type, [`PollEvented`], is provided to enable custom
I/O objects to be registered with the event loop and receive the same treatment
as the networking types.

[`TcpListener`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.TcpListener.html
[`TcpStream`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.TcpStream.html
[`UdpSocket`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.UdpSocket.html
[`PollEvented`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.PollEvented.html

Recall that there are two guarantees required and provided by I/O objects in
`tokio-core`: operations are nonblocking and "futures aware." The
[`PollEvented`] type implements the "futures aware" guarantee and is typically
provided a nonblocking I/O object internally. This means that to implement your
own custom I/O object you typically just need to verify that it's nonblocking
and then pass it to `PollEvented::new`.

The [`PollEvented`] type provides two ways to interact with it. First, if the
underlying type implements `Read` and/or `Write` then `PollEvented<E>` will also
implement `Read`, `AsyncRead`, `Write`, and `AsyncWrite`. The underlying
implementation **must** be nonblocking and [`PollEvented`] will layer task
management on top so all you need to do is call `read` and `write`.

If you're working with objects that don't implement `Read` and `Write`, like UDP
sockets, then the raw methods to use are [`poll_read`][pe-pr] and
[`need_read`], (similarly for writes). To see an example of how to use these
let's take a look at the implementation of [`UdpSocket::recv_from`]

```rust,ignore
pub fn recv_from(&self, buf: &mut [u8]) -> io::Result<(usize, SocketAddr)> {
    if let Async::NotReady = self.io.poll_read() {
	return Err(mio::would_block())
    }
    match self.io.get_ref().recv_from(buf) {
	Ok(Some(n)) => Ok(n),
	Ok(None) => {
	    self.io.need_read();
	    Err(mio::would_block())
	}
	Err(e) => Err(e),
    }
}
```

First we are required to call [`poll_read`]. This will register our interest in
consuming the read readiness of the underlying object. This will also implicitly
register our task to get unparked if we're not yet readable. After
[`poll_read`] returns `Ready` we can access the underlying object with
[`get_ref`] and call the actual nonblocking operation.

In this case we're actually calling [`mio::UdpSocket::recv_from`] which returns
`Ok(None)` on "would block", and otherwise we just pass through the return
value.  Once we see "would block", however, we inform our instance of
[`PollEvented`] that we're no longer readable through the [`need_read`] method.
This will, like `NotReady` from [`poll_read`], register the current task to
receive a notification when the I/O object is readable.

[pe-pr]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.PollEvented.html#method.poll_read
[`need_read`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.PollEvented.html#method.need_read
[`UdpSocket::recv_from`]: https://docs.rs/tokio-core/0.1/tokio_core/net/struct.UdpSocket.html#method.recv_from
[`get_ref`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.PollEvented.html#method.get_ref
[`mio::UdpSocket::recv_from`]: https://docs.rs/mio/0.6/mio/udp/struct.UdpSocket.html#method.recv_from

And that's it for implementing a custom I/O object with [`tokio-core`]! You'll
need to be sure to implement the [`Evented`] trait from the [`mio`] crate as
well because [`mio`] is the backbone of [`tokio-core`].

[`Evented`]: https://docs.rs/mio/0.6/mio/trait.Evented.html
[`mio`]: https://github.com/carllerche/mio

## [Wakeup semantics](#wakeup-semantics) {#wakeup-semantics}

When working directly with [`PollEvented`] it's important to understand how
tasks are actually woken up. Otherwise, a mistaken call to a method like [`need_read`]
could accidentally block your program forever!

The [`need_read`] method (and the write version) have a special requirement that
they will not operate correctly unless the I/O object was previously witnessed
to not be readable. If the I/O object is already readable and [`need_read`] is
called, then the current task may never receive a notification that the object
is readable.

This currently corresponds to "edge semantics" with epoll and kqueue, meaning
that notifications are only received when the state changes for an I/O object.
The [`PollEvented`] may one day provide configuration to receive "level"
semantics where notifications are continually received while an object is
readable, but that is not currently implemented.
