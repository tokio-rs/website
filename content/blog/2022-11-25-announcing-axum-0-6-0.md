---
date: "2022-11-25"
title: "Announcing axum 0.6.0"
description: "November 25, 2022"
---

Back in August we announced [`axum`] [0.6.0-rc.1][rc1] and today I'm happy to
report that the prelease period is over and [`axum`] 0.6.0 is out!

[`axum`] is an ergonomic and modular web framework built with [`tokio`], [`tower`],
and [`hyper`].

This also includes new major versions for [`axum-core`], [`axum-extra`], and
[`axum-macros`].

If you've already read the [rc.1][rc1] announcement then some of these things
will be familiar. However many details of the APIs have been fine tuned to be
easier to use and more flexible.

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

In 0.6 you can use the new [`State`] extractor which works similarly to
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

let app = Router::new()
    .route("/", get(handler))
    // Provide the state for the router
    .with_state(state);

async fn handler(
    // And extract our shared `AppState` using `State`
    //
    // This will only compile if the type passed to `Router::with_state`
    // matches what we're extracting here
    State(state): State<AppState>,
) {}
```

`State` also supports extracting "sub states":

```rust
use axum::{
    extract::{State, FromRef},
    routing::get,
    Router,
};

// Our top level state that contains an `HttpClient` and a `Database`
//
// `#[derive(FromRef)]` makes them sub states so they can be extracted
// independently
#[derive(Clone, FromRef)]
struct AppState {
    client: HttpClient,
    database: Database,
}

#[derive(Clone)]
struct HttpClient {}

#[derive(Clone)]
struct Database {}

let state = AppState {
    client: HttpClient {},
    database: Database {},
};

let app = Router::new()
    .route("/", get(handler))
    .with_state(state);

async fn handler(
    // We can extract both `State<HttpClient>` and `State<Database>`
    State(client): State<HttpClient>,
    State(database): State<Database>,
) {}
```

It is also possible to use different state types on merged and nested sub routers:

```rust
let app = Router::new()
    // A route on the outermost router that requires `OuterState` as the
    // state
    .route("/", get(|_: State<OuterState>| { ... }))
    // Nest a router under `/api` that requires an `ApiState`
    //
    // We have to provide the state when nesting it into another router
    // since it uses a different state type
    .nest("/api", api_router().with_state(ApiState {}))
    // Same goes for routers we merge
    .merge(some_other_routes().with_state(SomeOtherState {}))
    // Finally provide the `OuterState` needed by the first route we
    // added
    .with_state(OuterState {});

// We don't need to provide the state when constructing the sub routers
//
// We only need to do that when putting everything together. That means
// we don't need to pass the different states around to each function
// that builds a sub router
fn api_router() -> Router<ApiState> {
    Router::new()
        .route("/users", get(|_: State<ApiState>| { ... }))
}

fn some_other_state() -> Router<SomeOtherState> {
    Router::new()
        .route("/foo", get(|_: State<SomeOtherState>| { ... }))
}

#[derive(Clone)]
struct ApiState {};

#[derive(Clone)]
struct SomeOtherState {};

#[derive(Clone)]
struct OuterState {};
```

While `Extension` still works we recommend users migrate to `State`, both
because it is more type safe but also because it is faster.

## Type safe extractor ordering

Continuing the theme of type safety, `axum` now enforces that only one extractor
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
consumes the request and that it was the last extractor. `axum` 0.6 now enforces
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

This also means that if you have implementations of [`FromRequest`] that
don't need the request body then you should implement [`FromRequestParts`]
instead.

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

There are also new [`map_request`] and [`map_response`] middleware functions that
work similarly to `middleware::from_fn`, as well as [`from_fn_with_state`],
[`map_request_with_state`,] and [`map_response_with_state`] versions that support
extracting `State`.

## Fallback inheritance for nested routers

In `axum` 0.5, nested routers weren't allowed to have fallbacks and would cause a panic:

```rust
let api_router = Router::new()
    .route("/users", get(|| { ... }))
    .fallback(api_fallback);

let app = Router::new()
    // this would panic since `api_router` has a fallback
    .nest("/api", api_router);
```

However in 0.6 that now just works and requests that start with `/api` but
aren't matched by `api_router` will go to `api_fallback`.

The outer router's fallback will still apply if a nested router doesn't have
its own fallback:

```rust
// This time without a fallback
let api_router = Router::new().route("/users", get(|| { ... }));

let app = Router::new()
    .nest("/api", api_router)
    // `api_fallback` will inherit this fallback
    .fallback(app_fallback);
```

So generally you just put fallbacks where you need them and axum will do the
right thing!

## WebAssembly support

`axum` now supports being compiled to WebAssembly by disabling the `tokio`
feature:

```toml
axum = { version = "0.6", default-features = false }
```

`default-features = false` will disable the `tokio` feature which is among the
default features.

This will disable the parts of `tokio`, `hyper`, and `axum` that don't
support WebAssembly.

## Trailing slash redirects removed

Previously if you had a route for `/foo` but got a request to `/foo/`, `axum`
would send a redirect response to `/foo`. However many found this behavior
surprising and it had edge-case bugs when combined with services that did their
own redirection, or used middleware, so in 0.6 we decided to remove this
feature.

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

If you want to opt into the old behavior you can use
[`RouterExt::route_with_tsr`] from [`axum-extra`].

## Mix wildcard routes and regular routes

`axum`'s `Router` now has better support for mixing wildcard routes and regular
routes:

```rust
use axum::{Router, routing::get};

let app = Router::new()
    // In 0.5 these routes would be considered overlapping and not be
    // allowed but in 0.6 it just works
    .route("/foo/*rest", get(|| async {}))
    .route("/foo/bar", get(|| async {}));
```

[rc1]: https://tokio.rs/blog/2022-08-whats-new-in-axum-0-6-0-rc1

## See the changelog for more

I encourage you to read the [changelog] to see all the changes and for tips on
how to update from 0.5 to 0.6.

Also, please ask questions in [Discord] or [file issues] if you have trouble
updating or discover bugs.

<div style="text-align:right">&mdash; David Pedersen (<a href="https://twitter.com/davidpdrsn">@davidpdrsn</a>)</div>

[state docs]: https://docs.rs/axum/0.6.0/axum/extract/struct.State.html
[`State`]: https://docs.rs/axum/0.6.0/axum/extract/struct.State.html
[`FromRequest`]: https://docs.rs/axum/0.6.0/axum/extract/trait.FromRequest.html
[`FromRequestParts`]: https://docs.rs/axum/0.6.0/axum/extract/trait.FromRequestParts.html
[`middleware::from_fn`]: https://docs.rs/axum/0.6.0/axum/middleware/fn.from_fn.html
[`RouterExt::route_with_tsr`]: https://docs.rs/axum-extra/0.4.0/axum_extra/routing/trait.RouterExt.html#tymethod.route_with_tsr
[extract state in middleware]: https://docs.rs/axum/0.6.0/axum/middleware/index.html#accessing-state-in-middleware
[changelog]: https://github.com/tokio-rs/axum/blob/main/axum/CHANGELOG.md
[Discord]: https://discord.gg/tokio
[file issues]: https://github.com/tokio-rs/axum/issues
[`map_response`]: https://docs.rs/axum/0.6.0/axum/middleware/fn.map_response.html
[`map_request`]: https://docs.rs/axum/0.6.0/axum/middleware/fn.map_request.html
[`map_response_with_state`]: https://docs.rs/axum/0.6.0/axum/middleware/fn.map_response_with_state.html
[`map_request_with_state`]: https://docs.rs/axum/0.6.0/axum/middleware/fn.map_request_with_state.html
[`from_fn_with_state`]: https://docs.rs/axum/0.6.0/axum/middleware/fn.from_fn_with_state.html
[`axum-core`]: https://crates.io/crates/axum-core
[`axum-extra`]: https://crates.io/crates/axum-extra
[`axum-macros`]: https://crates.io/crates/axum-macros
[`axum`]: https://crates.io/crates/axum
[`tokio`]: https://crates.io/crates/tokio
[`tower`]: https://crates.io/crates/tower
[`hyper`]: https://crates.io/crates/hyper
