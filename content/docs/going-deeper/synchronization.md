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

## Oneshot

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

## Channels

TODO: update this text

For the [`Stream`] trait, a similar primitive is available, [`channel`]. This
type also has two halves, where the sending half is used to send messages and
the receiving half implements `Stream`.

The channel's [`Sender`] type differs from the standard library's in an
important way: when a value is sent to the channel it consumes the sender,
returning a future that will resolve to the original sender only once the sent
value is consumed. This creates backpressure so that a producer won't be able to
make progress until the consumer has caught up.

[`channel`]: https://docs.rs/futures/0.1/futures/stream/fn.channel.html
[`Sender`]: https://docs.rs/futures/0.1/futures/stream/struct.Sender.html

## Bilock

TODO: write this section
