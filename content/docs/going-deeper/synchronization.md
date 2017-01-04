+++
title = "Synchronization"
description = "Coordinating concurrent futures"
menu = "going_deeper"
weight = 103
+++

The `futures-rs` crate comes equipped with a small *futures-aware
synchronization* toolkit, in the [`sync` module]. The abstractions here can be
used to coordinate concurrent interactions between futures, streams, or sinks.
Like the rest of the futures library, these APIs are non-blocking; they work
with the [`futures-rs` task system].

[`sync` module]: https://docs.rs/futures/0.1/futures/sync/index.html
[`sync`]: https://docs.rs/futures/0.1/futures/sync/index.html
[`futures-rs` task system]: ../futures-model

## [Oneshot](#oneshot) {#oneshot}

One of the most useful tools in [`sync`] is the [`oneshot`] module, providing a
"channel" which can be used precisely once. A oneshot models what can typically
be found as a future in many other languages, a producer/consumer pattern. Let's
take a look at an example:

[`oneshot`]: https://docs.rs/futures/0.1/futures/sync/fn.oneshot.html

```rust
extern crate futures;

use std::thread;
use futures::Future;
use futures::sync::oneshot;

fn expensive_computation() -> u32 {
    // ...
    200
}

fn main() {
    let (tx, rx) = oneshot::channel();

    thread::spawn(move || {
        tx.complete(expensive_computation());
    });

    let rx = rx.map(|x| x + 3);
    let result = rx.wait().unwrap();
    assert_eq!(result, 203);
}
```

Here we can see that the [`oneshot::channel`] function returns two halves (like
[`mpsc::channel` in the standard library][mpsc-std]). The first half, `tx`
("transmitter"), is of type [`Sender`] and is used to provide a value to the
future on the other end. The [`Sender::complete`] method will transmit the
value to the receiving end.

The second half, `rx` ("receiver"), is of type [`Receiver`] which
is a type that implements the [`Future`] trait. The `Item` type is `T`, the
type of the oneshot.  The `Error` type is [`Canceled`], which happens when the
[`Sender`] half is dropped without completing the computation.

[`oneshot::channel`]: https://docs.rs/futures/0.1/futures/sync/oneshot/fn.channel.html
[mpsc-std]: https://doc.rust-lang.org/std/sync/mpsc/fn.channel.html
[`Sender`]: https://docs.rs/futures/0.1/futures/sync/oneshot/struct.Sender.html
[`Sender::complete`]: https://docs.rs/futures/0.1/futures/sync/oneshot/struct.Sender.html#method.complete
[`Receiver`]: https://docs.rs/futures/0.1/futures/sync/oneshot/struct.Receiver.html
[`Canceled`]: https://docs.rs/futures/0.1/futures/struct.Canceled.html

This concrete implementation of `Future` can be used (as shown here) to
communicate values across threads. Each half implements the `Send` trait and is
a separately owned entity to get passed around. Note that if you're familiar
with futures from other languages this type may seem quite familiar, as
sometimes this is the *only* type that's a future. With the [`futures`] crate,
however, it's recommended to only use this type when necessary, relying on
trait methods for sequencing like [`and_then`] where possible.

[`and_then`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.and_then

The [`Sender`] type also provides the ability to get notified when the
[`Receiver`] is no longer interested in a value being produced. In other words,
the producer ([`Sender`]) can get notified when the consumer ([`Receiver`])
is dropped. The [`Sender::poll_cancel`] method will register the current task
to receive such a notification. For example:

[`Sender::poll_cancel`]: https://docs.rs/futures/0.1/futures/sync/oneshot/struct.Sender.html#method.poll_cancel

```rust
extern crate futures;

use std::thread;
use std::time::Duration;

use futures::Future;
use futures::future;
use futures::sync::oneshot;

fn main() {
    let (mut tx, rx) = oneshot::channel::<()>();

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(20));
        drop(rx);
    });

    let future = future::poll_fn(|| tx.poll_cancel());
    future.wait().unwrap();
}
```

Here we simulate the consumer (our separate thread) becoming disinterested in
the value-to-be-produced after some time has passed (20ms here). The
[`poll_fn`] combinator is then used to turn [`Sender::poll_cancel`] into a
future.

[`poll_fn`]: https://docs.rs/futures/0.1/futures/future/fn.poll_fn.html

If you call `poll_cancel` then you'll typically do so within a custom
implementation of the [`Future`] trait. This allows you to be able to check for
cancellation but also still be able to send a value if the value becomes ready.

[`Future`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html
[`Stream`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html
[`futures`]: https://github.com/alexcrichton/futures-rs

## [Channels](#channels) {#channels}

The oneshot channel above is useful for sending one value or just as a concrete
implementation of the [`Future`] trait, but often many values need to be
sent over time as well. For this, a concrete implementation of the [`Stream`]
trait is available in the [`mpsc`] module of the [`futures`] crate.

[`mpsc`]: https://docs.rs/futures/0.1/futures/sync/mpsc/index.html

The [`mpsc`] module stands for Multi-Producer Single-Consumer. This module is
very similar to that in the [standard library][mpsc-std]. The channel in
this module has two halves, like oneshot above, for sending and receiving
values. Let's take a look how this might be used by creating a helper function
that uses a worker thread to create a stream of lines on stdin:

```rust
extern crate futures;

use std::io::{self, BufRead};
use std::thread;

use futures::{Stream, Sink, Future};
use futures::stream::BoxStream;
use futures::sync::mpsc;

fn stdin() -> BoxStream<String, io::Error> {
    let (mut tx, rx) = mpsc::channel(1);

    thread::spawn(|| {
        let stdin = io::stdin();
        for line in stdin.lock().lines() {
            match tx.send(line).wait() {
                Ok(t) => tx = t,
                Err(_) => break,
            }
        }
    });

    rx.then(|r| r.unwrap()).boxed()
}
#
# fn main() {}
```

There's quite a lot in play here, so let's take a closer look and explain in
detail what's happening. First up we see:

```rust,ignore
let (mut tx, rx) = mpsc::channel(1);
```

This statement creates a new channel and returns the two halves of it. The `tx`
variable is a [`Sender`][mpsc-tx] and `rx` is a [`Receiver`][mpsc-rx]. The
integer argument here, 1, we'll get to in a moment.

Next up we'll see our helper thread spawned via `thread::spawn`. This thread
closes over the `tx` value to send data along the channel, and inside we see:

```rust,ignore
let stdin = io::stdin();
for line in stdin.lock().lines() {
    match tx.send(line).wait() {
        Ok(t) => tx = t,
        Err(_) => break,
    }
}
```

This just gets a handle to stdin, creates a blocking iterator using the standard
library over all lines of input on stdin, and then executes some code per line.
The first operation to do per each line is:

```rust,ignore
tx.send(line).wait()
```

This is using [`Sender`][mpsc-tx]'s implementation of the [`Sink`] trait to
call the [`Sink::send`] method. Recall that sinks model *backpressure*, so
sending a value may not always complete immediately. Consequently the return
value of [`send`][`Sink::Send`] is [a future][`Send`]. In our example our worker
thread is blocking, and we can't make more progress until our line of stdin is
sent, so we just immediately call [`wait`].

Precisely how the [`mpsc`] module applies backpressure depends on how the
channel was created. Earlier we called the [`mpsc::channel`] function with an
argument of 1, and this indicates that the channel will have approximately
space for one message before it applies backpressure to senders. In our case it
means that we can send one line off stdin without blocking, but the next one
may block until the first is received.

The [`mpsc`] module also supports channels which do not apply backpressure
through the [`mpsc::unbounded`] function. These types also implement the
[`Sink`] and [`Stream`] traits but you're guaranteed that the [`Sink`] method
[`start_send`] will never return "not ready". To signify this there is an
auxiliary [`UnboundedSender::send`] method which immediately returns a result.
Note that unbounded channels should be used with great care as it may be easy
for them to exhaust the resources of an overloaded system as they don't model
backpressure from one end of a system to another.

[mpsc-rx]: https://docs.rs/futures/0.1/futures/sync/mpsc/struct.Receiver.html
[mpsc-tx]: https://docs.rs/futures/0.1/futures/sync/mpsc/struct.Sender.html
[`Sink`]: https://docs.rs/futures/0.1/futures/sink/trait.Sink.html
[`Sink::send`]: https://docs.rs/futures/0.1/futures/sink/trait.Sink.html#method.send
[`Send`]: https://docs.rs/futures/0.1/futures/sink/struct.Send.html
[`wait`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.wait
[`mpsc::channel`]: https://docs.rs/futures/0.1/futures/sync/mpsc/fn.channel.html
[`mpsc::unbounded`]: https://docs.rs/futures/0.1/futures/sync/mpsc/fn.unbounded.html
[`start_send`]: https://docs.rs/futures/0.1/futures/sink/trait.Sink.html#tymethod.start_send
[`UnboundedSender::send`]: https://docs.rs/futures/0.1/futures/sync/mpsc/struct.UnboundedSender.html#method.send

Moving along in our code example, we next see:

```rust,ignore
match ... {
    Ok(t) => tx = t,
    Err(_) => break,
}
```

Here we're just taking a look at the result of the [`wait`] operation. A
successful send represents that the message was sent along the channel and is
enqueued for the receiver to acquire. In this case we get the sender back
(consumed by [`send`][`Send::send`] earlier), and we just reassign it to `tx`.

The erroneous case, however, is also important here. In the case of an error
we'll get back a [`SendError`]. This type means that the message failed to
send, which for mpsc channels means that the receiver has gone away. This error
means that we'll never be able to send another message, so here we just
terminate the worker thread by breaking out of the loop.

[`SendError`]: https://docs.rs/futures/0.1/futures/sync/mpsc/struct.SendError.html

That about wraps up our example with mpsc channels. We've seen that these
channels come in two variants: one with a configurable amount of backpressure
and one without. These channels implement the standard [`Sink`] and [`Stream`]
traits and model cross-thread communication. One last note to make is that the
"multi producer" aspect is implemented through an implementation of [`Clone`] on
the [`Sender`][mpsc-tx] type. Through that trait you can create multiple
handles, all of which can send values to one receiver.

[`Clone`]: https://doc.rust-lang.org/std/clone/trait.Clone.html

## [BiLock](#bilock) {#bilock}

The final tool in the [`sync`] toolkit that the [`futures`] crate provides is a
primitive called a [`BiLock`]. This type is similar to a [`Mutex`] in that
it provides synchronized access to an owned value. Unlike [`Mutex`], however, a
[`BiLock`] only allows at most two aliases to the data.

[`BiLock`]: https://docs.rs/futures/0.1/futures/sync/struct.BiLock.html
[`Mutex`]: https://doc.rust-lang.org/std/sync/struct.Mutex.html

To get a better idea about how [`BiLock`] is useful, let's take a look at the
implementation of the [`Stream::split`] method:

[`Stream::split`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.split

```rust
# extern crate futures;
# use futures::sync::BiLock;
# use futures::Sink;
# struct SplitSink<T>(BiLock<T>);
# struct SplitStream<T>(BiLock<T>);
# trait Stream {
fn split(self) -> (SplitSink<Self>, SplitStream<Self>)
    where Self: Sink + Sized
{
    let (a, b) = BiLock::new(self);
    let read = SplitStream(a);
    let write = SplitSink(b);
    (write, read)
}
# }
# fn main() {}
```

This method ends up being a perfect use case for [`BiLock`] where we simply
want synchronized access between two owners, no more. The [`BiLock::new`]
method consumes the data of the lock and returns the two separate owners. These
are then stashed away in `SplitStream` and `SplitSink` to get returned.

[`BiLock::new`]: https://docs.rs/futures/0.1/futures/sync/struct.BiLock.html#method.new

Some of the real magic happens, though, in the implementations of [`Stream`]
and [`Sink`] on these types. Let's take a look at the [`Stream`] implementation
for `SplitStream`:

```rust
# extern crate futures;
#
# use futures::Stream;
# use futures::sync::BiLock;
#
# pub struct SplitStream<S>(BiLock<S>);
#
impl<S: Stream> Stream for SplitStream<S> {
    type Item = S::Item;
    type Error = S::Error;

    fn poll(&mut self) -> Poll<Option<S::Item>, S::Error> {
        match self.0.poll_lock() {
            Async::Ready(mut inner) => inner.poll(),
            Async::NotReady => Ok(Async::NotReady),
        }
    }
}
```

Here we can see the [`poll_lock`] method in action. This method is similar to
[`try_lock`] on mutexes where it will not block but it attempts to acquire the
lock. The [`poll_lock`] method, however, is "futures aware" which means that
it interacts with the task system, namely calling [`task::park`].

The [`Async`] return value indicates whether the lock was acquired or whether
the lock is already held by the other owner (remember there can only be one
other owner). In the case of `Ready` the payload is an RAII object
[`BiLockGuard`] which similar to [`MutexGuard`] in the standard library will
allow mutable access to the internal data and will unlock the lock when
dropped.

If we get `NotReady` from [`poll_lock`] then this signifies that our task is
ready to receive a wakeup when the lock is unlocked. This means that we just
propagate `NotReady` outwards as we're unable to make progress at this time.

[`poll_lock`]: https://docs.rs/futures/0.1/futures/sync/struct.BiLock.html#method.poll_lock
[`try_lock`]: https://doc.rust-lang.org/std/sync/struct.Mutex.html#method.try_lock
[`task::park`]: https://docs.rs/futures/0.1/futures/task/fn.park.html
[`Async`]: https://docs.rs/futures/0.1/futures/enum.Async.html
[`BiLockGuard`]: https://docs.rs/futures/0.1/futures/sync/struct.BiLockGuard.html
[`MutexGuard`]: https://doc.rust-lang.org/std/sync/struct.MutexGuard.html

Semantically this implementation means that if the lock is acquired, we check
to see if the stream has an element to make progress. If the lock couldn't be
acquired, then we'll try again to look at the stream when the lock is unlocked.

The [`BiLock`] primitive is quite restrictive in that it only allows at most
two aliases to the data owned internally. Eventually we'd like to extend the
[`futures`] crate to have a full-blown mutex, but at this time it's not
implemented.
