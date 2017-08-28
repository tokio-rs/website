+++
title = "Returning futures"
description = ""
menu = "going_deeper_futures"
weight = 201
aliases = [
  "/docs/going-deeper/returning/"
]
+++

[`Future`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html
[`Iterator`]: https://doc.rust-lang.org/std/iter/trait.Iterator.html

When working with futures, one of the first things you're likely to need to do
is to return a [`Future`]. As with [`Iterator`]s, however, doing so can be a little tricky.
There are several options, listed from most to least ergonomic:

* [Trait objects][return-trait-objects]
* [`impl Trait`][return-impl-trait]
* [Named types][return-named-types]
* [Custom types][return-custom-types]

### [Trait objects](#trait-objects) {#trait-objects}
[return-trait-objects]: #trait-objects

First, you always have the option of returning a boxed [trait object]:

```rust
# #![deny(deprecated)]
# extern crate futures;
# use std::io;
# use futures::Future;
# fn main() {}
fn foo() -> Box<Future<Item = u32, Error = io::Error>> {
    // ...
# loop {}
}
```

The upside of this strategy is that it's easy to write down (just a [`Box`]) and
easy to create. This is also maximally flexible in terms of future changes to
the method as *any* type of future can be returned as an opaque, boxed `Future`.

[`Box`]: https://doc.rust-lang.org/std/boxed/struct.Box.html

The downside of this approach is that it requires a runtime allocation when the
future is constructed, and dynamic dispatch when using that future. The `Box`
needs to be allocated on the heap and the future itself is then placed
inside. Note, though that this is the *only* allocation here, otherwise while
the future is being executed no allocations will be made.

It's often possible to mitigate that cost by boxing only at the end of a long
chain of futures you want to return, which entails only a single allocation and
dynamic dispatch for the entire chain.

[trait object]: https://doc.rust-lang.org/book/trait-objects.html

### [`impl Trait`](#impl-trait) {#impl-trait}
[return-impl-trait]: #impl-trait

In an ideal world, however, we can have our cake and eat it too with a new
language feature called [`impl Trait`]. This language feature will allow, for
example:

[`impl Trait`]: https://github.com/rust-lang/rfcs/blob/master/text/1522-conservative-impl-trait.md

```rust,ignore
fn add_10<F>(f: F) -> impl Future<Item = i32, Error = F::Error>
    where F: Future<Item = i32>,
{
    f.map(|i| i + 10)
}
```

Here we're indicating that the return type is "something that implements
`Future`" with the given associated types. Other than that we just use the
future combinators as we normally would.

The upsides to this approach are that it is zero overhead with no `Box`
necessary, it's maximally flexible to future implementations as the actual
return type is hidden, and it's ergonomic to write as it's similar to the nice
`Box` example above.

The downside to this approach is only that it's not on stable Rust yet. As of
the time of this writing [`impl Trait`] is available on nightly, but will likely
take some time to stabilize. You can track the progress of this feature at
[rust-lang/rust#34511]. The good news, however, is that as soon as `impl
Trait` hits stable Rust, all crates using futures can immediately benefit. It
should be a backwards-compatible extension to change return types from `Box` to
[`impl Trait`].

[rust-lang/rust#34511]: https://github.com/rust-lang/rust/issues/34511

### [Named types](#named-types) {#named-types}
[return-named-types]: #named-types

If you wouldn't like to return a `Box` and want to stick with stable Rust, another
option is to write the return type directly:

```rust
# #![deny(deprecated)]
# extern crate futures;
# use futures::Future;
# use futures::future::Map;
# fn main() {}
fn add_10<F>(f: F) -> Map<F, fn(i32) -> i32>
    where F: Future<Item = i32>,
{
    fn do_map(i: i32) -> i32 { i + 10 }
    f.map(do_map)
}
```

Here we name the return type exactly as the compiler sees it. The `map`
function returns the [`Map`] struct which internally contains the future and the
function to perform the map.

The upside to this approach is that it doesn't have the runtime overhead of
`Box` from before, and works on stable Rust.

The downside, however, is that it's often quite difficult to name the type.
Sometimes the types can get quite large or be unnameable altogether. Here we're
using a function pointer (`fn(i32) -> i32`), but we would ideally use a closure.
Unfortunately, the return type cannot name the closure, for now. It also leads to
very verbose signatures, and leaks implementation details to clients.

[`Map`]: https://docs.rs/futures/0.1/futures/future/struct.Map.html

### [Custom types](#custom-types) {#custom-types}
[return-custom-types]: #custom-types

Finally, you can wrap the concrete return type in a new type, and implement
future for it. For example:

```rust,ignore
struct MyFuture {
    inner: Sender<i32>,
}

fn foo() -> MyFuture {
    let (tx, rx) = oneshot::channel();
    // ...
    MyFuture { inner: tx }
}

impl Future for MyFuture {
    // ...
}
```

In this example we're returning a custom type, `MyFuture`, and we implement the
`Future` trait directly for it. This implementation leverages an underlying
`Oneshot<i32>`, but any other kind of protocol can also be implemented here as
well.

The upside to this approach is that it won't require a `Box` allocation and it's
still maximally flexible. The implementation details of `MyFuture` are hidden to
the outside world so it can change without breaking others.

The downside to this approach, however, is that this is the least ergonomic way
to return futures.
