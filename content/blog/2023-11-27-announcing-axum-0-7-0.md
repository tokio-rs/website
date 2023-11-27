---
date: "2023-11-27"
title: "Announcing axum 0.7.0"
description: "November 23, 2022"
---

Today, we're happy to announce [`axum`] version 0.7. `axum` is an ergonomic
and modular web framework built with [`tokio`], [`tower`], and [`hyper`].

This also includes new major versions of [`axum-core`], [`axum-extra`], and
[`axum-macros`].

## `hyper` 1.0 support

The headline feature of `axum` 0.7 is support for `hyper` 1.0. `hyper` is a
foundational library for much of the networking ecosystem in Rust and finally
having a stable API is a big milestone.

[`hyper` is guaranteeing] to not make any more breaking changes for the next
three years which means the surrounding ecosystem can also become more stable.

`hyper` 1.0 comes with a big shuffling of the APIs. The previous low level APIs
(found in [`hyper::server::conn`]) were stabilized whereas the high
level APIs (such as [`hyper::Server`]) have been removed.

The plan is to add the high level APIs to a new crate called [`hyper-util`].
There we can build out the APIs without worrying too much about stability
guarantees and backwards compatibility. When something is ready for
stabilization it can be moved into `hyper`.

`hyper-util` is still in early stages of development and some things (like the
previous `Server` type) are still missing.

Because `hyper-util` is not stable we don't want it to be part of `axum`'s
public API. If you want to use something from `hyper-util` you have to depend
it directly.

If you are using `axum` together with `tower-http`, please note that since both
have a public dependency on the `http` crate which also had its 1.0 release,
you need to upgrade `tower-http` at the same time (to v0.5+).

## A new `axum::serve` function

`axum` 0.6 provided `axum::Server` which was an easy way to get started.
`axum::Server` was however just a re-export of `hyper::Server` which has been
removed from `hyper` 1.0.

There isn't yet a full replacement in `hyper-util` so `axum` now provides its
own `serve` function:

```rust
use axum::{
    routing::get,
    Router,
};
use tokio::net::TcpListener;

let app = Router::new().route("/", get(|| async { "Hello, World!" }));

let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
axum::serve(listener, app).await.unwrap();
```

The purpose of `axum::serve` is to provide a way to get started with `axum`
quickly and as such it does not support any configuration options whatsoever.
If you need configuration you have to use `hyper` and `hyper-util` directly. We
provide an example showing how to do that [here][hyper-serve-example].

## Our own `Body` type

The [`http-body`] crate is now also at 1.0 and that comes with a similar API split
that `hyper` and `hyper-util` have. `http-body` now just provides the core APIs,
and high level utilities has been moved to [`http-body-util`]. That includes
things like `Full`, `Empty`, and `UnsyncBoxBody`, which used to be re-exported by
`axum`.

For the same reason that `hyper-util` shouldn't be part of `axum`'s public API,
`http-body-util` shouldn't either.

As a replacement, `axum` now provides its own body type found at `axum::body::Body`.

Its API is similar to what `hyper::Body` had:

```rust
use axum::body::Body;
use futures::TryStreamExt;
use http_body_util::BodyExt;

// Create an empty body (Body::default() does the same)
Body::empty();

// Create bodies from strings or buffers
Body::from("foobar");
Body::from(Vec::<u8>::from([1, 3, 3, 7]));

// Wrap another type that implements `http_body::Body`
Body::new(another_http_body);

// Convert a `Body` into a `Stream` of data frames
let mut stream = body.into_data_stream();
while let Some(chunk) = stream.try_next().await? {
    // ...
}

// Collect the body into a `Bytes`. Uses `BodyExt::collect`
// This replaces the previous `hyper::body::to_bytes` function
let bytes = body.collect().await?.to_bytes();
```

## Fewer generics

`axum::Router` used to be generic over the request body type. That meant
applying middleware that changed the request body type would have knock-on
effects throughout your routes:

```rust
// This would work just fine
Router::new()
    .route(
        "/",
        get(|body: Request<Body>| async { ... })
    );

// But adding `tower_http::limit::RequestBodyLimitLayer` would make
// things no longer compile
Router::new()
    .route(
        "/",
        get(|body: Request<Body>| async { ... })
    )
    .layer(tower_http::limit::RequestBodyLimitLayer::new(1024));
```

The reason it doesn't work is that `RequestBodyLimitLayer` changes the request
body type so you have to extract `Request<http_body::Limited<Body>>` instead of
`Request<Body>`. This was very subtle and the source of some confusion.

In axum 0.7, everything continues working as before, regardless of which
middleware you add:

```rust
Router::new()
    .route(
        "/",
        // You always extract `Request<Body>` no matter
        // which middleware you add
        //
        // This works because `Router` internally converts
        // the body into an `axum::body::Body`, which internally
        // holds a trait object
        get(|body: Request<Body>| async { ... })
    )
    .layer(tower_http::limit::RequestBodyLimitLayer::new(1024));
```

There is also a convenient type alias of `http::Request` that uses axum's `Body` type:

```rust
use axum::extract::Request;

Router::new().route("/", get(|body: Request| async { ... }));
```

The request body type parameter has been removed from all of `axum`'s types and
traits including `FromRequest`, `MethodRouter`, `Next`, and more.

## See the changelog for more

I encourage you to read the [changelog] to see all the changes and for tips on
how to upgrade from 0.6 to 0.7.

Also, please [open a GitHub discussion] if you have trouble updating. You're
also welcome to ask questions in [Discord].

<div style="text-align:right">&mdash; David Pedersen (<a href="https://twitter.com/davidpdrsn">@davidpdrsn</a>)</div>

[`axum`]: https://crates.io/crates/axum
[`tokio`]: https://crates.io/crates/tokio
[`tower`]: https://crates.io/crates/tower
[`hyper`]: https://crates.io/crates/hyper
[`hyper-util`]: https://crates.io/crates/hyper-util
[`http-body`]: https://crates.io/crates/http-body
[`http-body-util`]: https://crates.io/crates/http-body-util
[`tower-http`]: https://crates.io/crates/tower-http
[changelog]: https://github.com/tokio-rs/axum/blob/main/axum/CHANGELOG.md
[Discord]: https://discord.gg/tokio
[open a GitHub discussion]: https://github.com/tokio-rs/axum/discussions
[`hyper::server::conn`]: https://docs.rs/hyper/0.14.27/hyper/server/conn/index.html
[`hyper::Server`]: https://docs.rs/hyper/0.14.27/hyper/server/struct.Server.html
[`axum-core`]: https://crates.io/crates/axum-core
[`axum-extra`]: https://crates.io/crates/axum-extra
[`axum-macros`]: https://crates.io/crates/axum-macros
[hyper-serve-example]: https://github.com/tokio-rs/axum/blob/main/examples/serve-with-hyper/src/main.rs
[`hyper` is guaranteeing]: https://seanmonstar.com/blog/hyper-v1/
