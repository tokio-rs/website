+++
title = "Synchronization"
description = "Coordinating concurrent futures"
menu = "going_deeper"
weight = 103
+++

The `futures-rs` crate comes equipped with a small *futures-aware
synchronization* toolkit, in the [`sync` module]. The abstractions here can be
used to coordinate concurrent interactions between futures, streams, or sinks. Like the rest of the futures library, these APIs are non-blocking; they work with the [`futures-rs` task system].

[`sync` module]: https://docs.rs/futures/0.1.7/futures/sync/index.html
[`futures-rs` task system]: ../futures-model

## Oneshot

TODO: introductory text

[`oneshot`]: https://docs.rs/futures/0.1/futures/sync/fn.oneshot.html

```rust
extern crate futures;

use std::thread;
use futures::Future;

fn expensive_computation() -> u32 {
    // ...
    200
}

fn main() {
    let (tx, rx) = futures::oneshot();

    thread::spawn(move || {
        tx.complete(expensive_computation());
    });

    let rx = rx.map(|x| x + 3);
}
```

Here we can see that the [`oneshot`] function returns two halves (like
[`mpsc::channel`]). The first half, `tx` ("transmitter"), is of type [`Complete`]
and is used to complete the oneshot, providing a value to the future on the
other end. The [`Complete::complete`] method will transmit the value to the
receiving end.

The second half, `rx` ("receiver"), is of type [`Oneshot`][oneshot-type] which is
a type that implements the [`Future`] trait. The `Item` type is `T`, the type
of the oneshot.  The `Error` type is [`Canceled`], which happens when the
[`Complete`] half is dropped without completing the computation.

[`mpsc::channel`]: https://doc.rust-lang.org/std/sync/mpsc/fn.channel.html
[`Complete`]: https://docs.rs/futures/0.1/futures/struct.Complete.html
[`Complete::complete`]: https://docs.rs/futures/0.1/futures/struct.Complete.html#method.complete
[oneshot-type]: https://docs.rs/futures/0.1/futures/struct.Oneshot.html
[`Canceled`]: https://docs.rs/futures/0.1/futures/struct.Canceled.html

This concrete implementation of `Future` can be used (as shown here) to
communicate values across threads. Each half implements the `Send` trait and is
a separately owned entity to get passed around. It's generally not recommended
to make liberal use of this type of future, however; the combinators above or
other forms of base futures should be preferred wherever possible.

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
