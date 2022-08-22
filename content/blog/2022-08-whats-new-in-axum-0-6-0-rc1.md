---
date: "2022-08-23"
title: "What's new in axum 0.6.0-rc.1"
description: "August 23, 2022"
---

Today, we're happy to announce [`axum`] version 0.6.0-rc.1. `axum` is an ergonomic and
modular web framework built with `tokio`, `tower`, and `hyper`.

In 0.6 we've reworked some fundamental parts of axum to make things more type
safe, less surprising, and easier to use. In this post I'd like to highlight a
few of the most impactful changes and new features.

This also includes new major versions for [`axum-core`], [`axum-extra`], and
[`axum-macros`].

## Type safe `State` extractor

Previously the recommended way to share state with handlers was to use the
`Extension` middleware and extractor:

```rust
use axum::{
    Router,
    Extension,
    routing::get,
};

#[derive(Clone)]
struct AppState {}

let state = AppState {};

let app = Router::new()
    .route("/", get(handler))
    // Add `Extension` as a middleware
    .layer(Extension(state));

async fn handler(
    // And extract our shared `AppState` using `Extension`
    Extension(state): Extension<AppState>,
) {}
```

However this wasn't type safe, so if you forgot `.layer(Extension(...))` things
would compile just fine but you'd get runtime errors when calling `handler`.

In 0.6 you can use the new `State` extractor which works similarly to
`Extension` but is type safe:

```rust
use axum::{
    Router,
    extract::State,
    routing::get,
};

#[derive(Clone)]
struct AppState {}

let state = AppState {};

// Create the `Router` using `with_state`
let app = Router::with_state(state)
    .route("/", get(handler));

async fn handler(
    // And extract our shared `AppState` using `State`
    //
    // This will only compile if the type passed to `Router::with_state`
    // matches what we're extracting here
    State(state): State<AppState>,
) {}
```

`State` also supports extracting "substates". See [the docs][state docs] for more details.

While `Extension` still works we recommend users migrate to `State`, both
because it is more type safe but also because it is faster.

## Type safe extractor ordering

Continuing the theme of type safety, axum now enforces that only one extractor
consumes the request body. In 0.5 this would compile just fine but fail at
runtime:

```rust
use axum::{
    Router,
    Json,
    routing::post,
    body::Body,
    http::Request,
};

let app = Router::new()
    .route("/", post(handler).get(other_handler));

async fn handler(
    // This would consume the request body
    json_body: Json<serde_json::Value>,
    // This would also attempt to consume the body but fail
    // since it is gone
    request: Request<Body>,
) {}

async fn other_handler(
    request: Request<Body>,
    // This would also fail at runtime, even if the `AppState` extension
    // was set since `Request<Body>` consumes all extensions
    state: Extension<AppState>,
) {}
```

The solution was to manually ensure that you only use one extractor that
consumes the request and that it was the last extractor. axum 0.6 now enforces
this at compile time:

```rust
use axum::{
    Router,
    Json,
    routing::post,
    body::Body,
    http::Request,
};

let app = Router::new()
    .route("/", post(handler).get(other_handler));

async fn handler(
    // We cannot extract both `Request` and `Json`, have to pick one
    json_body: Json<serde_json::Value>,
) {}

async fn other_handler(
    state: Extension<AppState>,
    // `Request` must be extracted last
    request: Request<Body>,
) {}
```

This was done by reworking the [`FromRequest`] trait and adding a new
[`FromRequestParts`] trait.

## Run extractors from `middleware::from_fn`

[`middleware::from_fn`] makes it easy to write middleware using familiar
async/await syntax. In 0.6 such middleware can also run extractors:

```rust
use axum::{
    Router,
    middleware::{self, Next},
    response::{Response, IntoResponse},
    http::Request,
    routing::get,
};
use axum_extra::extract::cookie::{CookieJar, Cookie};

async fn my_middleware<B>(
    // Run the `CookieJar` extractor as part of this middleware
    cookie_jar: CookieJar,
    request: Request<B>,
    next: Next<B>,
) -> Response {
    let response = next.run(request).await;

    // Add a cookie to the jar
    let updated_cookie_jar = cookie_jar.add(Cookie::new("foo", "bar"));

    // Add the new cookies to the response
    (updated_cookie_jar, response).into_response()
}

let app = Router::new()
    .route("/", get(|| async { "Hello, World!" }))
    .layer(middleware::from_fn(my_middleware));
```

Note that this cannot be used to extract `State`. See [the docs][extract state
in middleware] for more details.

## Nested routers with fallbacks

`Router::nest` allows you to send all requests with a matching prefix to some
other router or service. However in 0.5 it wasn't possible for nested routers to
have their own fallbacks. In 0.6 that now works:

```rust
use axum::{Router, Json, http::StatusCode, routing::get};
use serde_json::{Value, json};

let api = Router::new()
    .route("/users/:id", get(|| async {}))
    // We'd like our API fallback to return JSON
    .fallback(api_fallback);

let app = Router::new()
    .nest("/api", api)
    // And our top level fallback to return plain text
    .fallback(top_level_fallback);

async fn api_fallback() -> (StatusCode, Json<Value>) {
    let body = json!({
        "status": 404,
        "message": "Not Found",
    });
    (StatusCode::NOT_FOUND, Json(body))
}

async fn top_level_fallback() -> (StatusCode, &'static str) {
    (StatusCode::NOT_FOUND, "Not Found")
}
```

## Trailing slash redirects removed

Previously if you had a route for `/foo` but got a request with `/foo/`, axum
would send a redirect response to `/foo`. However many found this behavior
surprising and it had edge-case bugs when combined with services that did their
own redirection, so in 0.6 we decided to remove this feature.

The recommended solution is to explicitly add the routes you want:

```rust
use axum::{
    Router,
    routing::get,
};

let app = Router::new()
    // Send `/foo` and `/foo/` to the same handler
    .route("/foo", get(foo))
    .route("/foo/", get(foo));

async fn foo() {}
```

If you want to opt into the old behavior you can use [`RouterExt::route_with_tsr`]

## Mix wildcard routes and regular routes

axum's `Router` now has better support for mixing wilcard routes and regular
routes:

```rust
use axum::{Router, routing::get};

let app = Router::new()
    // In 0.5 these routes would be considered overlapping and not be allowed
    // but in 0.6 it just works
    .route("/foo/*rest", get(|| async {}))
    .route("/foo/bar", get(|| async {}));
```

## See the changelog for more

I encourage you to read the [changelog] to see all the changes and for tips on
how to update from 0.5 to 0.6.0-rc.1.

Also, please ask questions in [Discord] or [file issues] if you have trouble
updating or discover bugs. If everything goes smoothly we expect to ship 0.6.0
in a few weeks.

<div style="text-align:right">&mdash; David Pedersen (<a href="https://twitter.com/davidpdrsn">@davidpdrsn</a>)</div>

[state docs]: TODO
[`FromRequest`]: TODO
[`FromRequestParts`]: TODO
[`middleware::from_fn`]: TODO
[`RouterExt::route_with_tsr`]: TODO
[extract state in middleware]: TODO
[changelog]: https://github.com/tokio-rs/axum/blob/main/axum/CHANGELOG.md
[Discord]: https://discord.gg/tokio
[file issues]: https://github.com/tokio-rs/axum/issues
