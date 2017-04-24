+++
title = "Essential combinators"
description = "Common APIs for futures and stream programming"
menu = "going_deeper_futures"
weight = 200
aliases = [
  "/docs/going-deeper/futures-mechanics/"
]
+++

We saw a few of the most important combinators in the
[futures](../../getting-started/futures) and
[streams](../../getting-started/streams-and-sinks) overviews. Here we'll take a
look at a few more. It's also worth spending some time with the trait
documentation to familiarize yourself with the full range of combinators
available.

### [Some concrete futures and streams](#concrete) {#concrete}

Any value can be turned into an immediately complete future. There are a few
functions in the `future` module for creating such a future:

- [`ok`], which is analogous to `Result::Ok`: it treats the value you give it as an immediately successful future.
- [`err`], which is analogous to `Result::Err`: it treats the value you give it as an immediately failed future.
- [`result`], which lifts a result to an immediately-complete future.

[`ok`]: https://docs.rs/futures/0.1/futures/future/fn.ok.html
[`err`]: https://docs.rs/futures/0.1/futures/future/fn.err.html
[`result`]: https://docs.rs/futures/0.1/futures/future/fn.result.html

For streams, there are a few equivalents of an "immediately ready" stream:

- [`iter`], which creates a stream that yields the same items as the underlying
iterator. The iterator produces `Result` values, and the first error terminates
the stream with that error.
- [`once`], which creates a single-element stream from a `Result`.

[`iter`]: https://docs.rs/futures/0.1/futures/stream/fn.iter.html
[`once`]: https://docs.rs/futures/0.1/futures/stream/fn.once.html

In addition to these constructors, there's also a function, [`lazy`], which
allows you to construct a future given a *closure* that will produce that future
later, on demand.

[`lazy`]: https://docs.rs/futures/0.1/futures/future/fn.lazy.html

### [IntoFuture](#intofuture) {#intofuture}

A crucial API to know about is the [`IntoFuture`] trait, which is a trait for
values that can be converted into futures. Most APIs that you think of as taking
futures actually work with this trait instead. The key reason: the trait is
implemented for `Result`, allowing you to return `Result` values in many places
that futures are expected.

[`IntoFuture`]: https://docs.rs/futures/0.1/futures/future/trait.IntoFuture.html

### [Adapters](#adapters) {#adapters}

Like [`Iterator`], the `Future`, `Stream` and `Sink` traits all come equipped
with a broad range of "adapter" methods. These methods all consume the receiving
object and return a new, wrapped one. For futures, you can use adapters to:

* Change the type of a future ([`map`], [`map_err`])
* Run another future after one has completed ([`then`], [`and_then`],
  [`or_else`])
* Figure out which of two futures resolves first ([`select`])
* Wait for two futures to both complete ([`join`])
* Convert to a trait object ([`boxed`])
* Convert unwinding into errors ([`catch_unwind`])

[`Iterator`]: https://doc.rust-lang.org/std/iter/trait.Iterator.html
[`Box`]: https://doc.rust-lang.org/std/boxed/struct.Box.html
[`map`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.map
[`map_err`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.map_err
[`then`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.then
[`and_then`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.and_then
[`or_else`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.or_else
[`select`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.select
[`join`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.join
[`boxed`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.boxed
[`catch_unwind`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.catch_unwind

For streams, there are a large set of adapters, including:

* Many in common with [`Iterator`], like [`map`][stream-map], [`fold`],
  [`collect`], [`filter`], [`zip`], [`take`], [`skip`] and so on. Note that [`fold`] and
  [`collect`] produce *futures*, and hence their result is computed
  asynchronously.
* Adapters for sequencing with futures ([`then`][stream-then],
  [`and_then`][stream-and_then], [`or_else`][stream-or_else])
* Additional adapters for combining streams ([`merge`], [`select`][stream-select])

[stream-map]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.map
[`fold`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.fold
[`collect`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.collect
[`filter`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.filter
[`zip`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.zip
[`take`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.take
[`skip`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.skip
[stream-then]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.then
[stream-and_then]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.and_then
[stream-or_else]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.or_else
[`merge`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.merge
[stream-select]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.select

The `Sink` trait currently has fewer adapters; the most important ones were
covered in [the introduction](../../getting-started/streams-and-sinks).

Finally, an object that is both a stream and a sink can be broken into separate
stream and sink objects using the [`split`] adapter.

[`split`]: https://docs.rs/futures/0.1/futures/stream/trait.Stream.html#method.split

All adapters are zero-cost, meaning that no memory is allocated internally and
the implementation will optimize to what you would have otherwise written by
hand.

### [Error handling](#error-handling) {#error-handling}

Futures, streams and sinks all treat error handling as a core concern: they are
all equipped with an associated error type, and the various adapter methods
interpret errors in sensible ways. For example:

- The sequencing combinators [`then`], [`and_then`], [`or_else`], [`map`], and
  [`map_err`] all chain errors similarly to the `Result` type in the standard
  library. So, for example, if you chain futures using [`and_then`] and the
  first future fails with an error, the chained future is never run.

- Combinators like [`select`] and [`join`] also deal with errors. For
  [`select`], the first future to complete *in any way* yields an answer,
  propagating the error, but also giving access to the other future should you
  want to keep working with it. For [`join`], if any future produces an error,
  the entire join produces that error.

By default, futures don't have any special handling for panics. In most cases,
though, futures are ultimately run as tasks within a thread pool, where you'll
want to catch any panic they produce and propagate that elsewhere. The
[`catch_unwind`] adapter can be used to reify a panic into a `Result` without
taking down the worker thread.
