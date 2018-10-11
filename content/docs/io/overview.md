---
title: "I/O Overview"
weight : 2010
menu:
  docs:
    parent: io
---

Rust [`std::io`] module provides traits that synchronously access resources like
files and sockets.  These `Read` and `Write` traits are implemented in other
modules including [`std::fs`] and `std::net`.

The [`tokio`] crate comes with a variation on those types, [`AsyncRead`] and
[`AsyncWrite`].  The primary difference between [`AsyncRead`] and `std::io::Read`
is the [`futures::Async`] return values.  The implementation returns an `Error`,
`NotReady`, or `Ready` value.

[`AsyncRead`]: {{< api-url "tokio" >}}/io/trait.AsyncRead.html
[`AsyncWrite`]: {{< api-url "tokio" >}}/io/trait.AsyncWrite.html
[`futures::Async`]: https://docs.rs/futures/0.1.18/futures/enum.Async.html
[`std::io`]: https://doc.rust-lang.org/std/io/#read-and-write
[`std::fs`]: https://doc.rust-lang.org/std/fs/struct.File.html#implementations
[`tokio`]: {{< api-url "tokio" >}}
