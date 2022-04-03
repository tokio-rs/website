---
date: "2022-03-31"
title: "What's new in axum 0.5"
description: "March 31, 2022"
---

Today, we're happy to announce [`axum`] version 0.5. `axum` is an ergonomic and
modular web framework built with `tokio`, `tower`, and `hyper`.

0.5 contains lots of new features and I'd like highlight a few of them here.

This also includes new major versions for [`axum-core`], [`axum-extra`], and
[`axum-macros`].

## The new [`IntoResponseParts`] trait

`axum` has always supported building responses by composing individual parts:

```rust
use axum::{
    Json,
    response::IntoResponse,
    http::{StatusCode, HeaderMap},
};
use serde_json::json;

// returns a JSON response
async fn json() -> impl IntoResponse {
    Json(json!({ ... }))
}

// returns a JSON response with a `201 Created` status code and
// a custom header
async fn json_with_status_and_header() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert("x-foo", "custom".parse().unwrap());

    (StatusCode::CREATED, headers, Json(json!({})))
}
```

However, you couldn't easily provide your own custom response parts. `axum` had to
specifically allow `HeaderMap` to be included in responses, and you couldn't
extend this system with your own types.

The new `IntoResponseParts` trait fixes that!

For example, we can add our own `SetHeader` type for setting a single header, and
implement `IntoResponseParts` for it.

```rust
use axum::{
    response::{ResponseParts, IntoResponseParts},
    http::{StatusCode, header::{HeaderName, HeaderValue}},
};

struct SetHeader<'a>(&'a str, &'a str);

impl<'a> IntoResponseParts for SetHeader<'a> {
    type Error = StatusCode;

    fn into_response_parts(
        self,
        mut res: ResponseParts,
    ) -> Result<ResponseParts, Self::Error> {
        let name = self.0.parse::<HeaderName>()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let value = self.1.parse::<HeaderValue>()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        res.headers_mut().insert(name, value);

        Ok(res)
    }
}
```

We can now use `SetHeader` in responses:

```rust
use axum::{Json, response::IntoResponse, http::StatusCode};
use serde_json::json;

async fn json_with_status_and_header() -> impl IntoResponse {
    (
        StatusCode::CREATED,
        SetHeader("x-foo", "custom"),
        SetHeader("x-bar", "another custom header"),
        Json(json!({})),
    )
}
```

`IntoResponseParts` is also implemented for [`Extension`], making it easy to set
response extensions. For example, this can be used to share state with middleware:

```rust
use axum::{Extension, Json, response::IntoResponse};
use serde_json::json;

async fn json_extensions() -> impl IntoResponse {
    (
        Extension(some_value),
        Extension(some_other_value),
        Json(json!({})),
    )
}
```

If including a status code it must be the first element of the tuple and any
response body must be the last. This ensures you only set those parts once and
don't accidentally override them.

See [`axum::response`] for more details.

## Cookies

Building on top of `IntoResponseParts` [`axum-extra`], has a new [`CookieJar`]
extractor:

```rust
use axum_extra::extract::cookie::{CookieJar, Cookie};
use axum::response::IntoResponseParts;

async fn handler(jar: CookieJar) -> impl IntoResponse {
    if let Some(cookie_value) = jar.get("some-cookie") {
        tracing::info!(?cookie_value);
    }

    let updated_jar = jar
        .add(Cookie::new("session_id", "value"))
        .remove(Cookie::named("some-cookie"));

    (updated_jar, "response body...")
}
```

It also comes in a [`SignedCookieJar`] variant that will sign cookies with a key, so
you're sure someone hasn't tampered with them.

`IntoResponseParts` makes this possible without requiring any middleware.

See [`axum_extra::extract::cookie`] for more details.

## `HeaderMap` extractor

You've always been able to use [`HeaderMap`] as an extractor to access headers
from the request. But what you might not realise is that this would implicitly
consume the headers, such that other extractors wouldn't be able to access them.

For example, this is subtly broken:

```rust
use axum::{http::HeaderMap, extract::Form};

async fn handler(
    headers: HeaderMap,
    form: Form<Payload>,
) {
    // ...
}
```

Since we run the `HeaderMap` first, `Form` would be unable to access them and
fail with a `500 Internal Server Error`. This was quite surprising, and caused
headaches for some users.

However, in `axum` 0.5 this problem goes away and it just works!

## More flexible `Router::merge`

[`Router::merge`] can be used to merge two routers into one. In axum 0.5, it has
gotten slightly more flexible, and now accepts any `impl Into<Router>`. This
allows you to have custom ways of constructing `Router`s, and have them work
seamlessly with `axum`.

One could imagine a way to compose REST and gRPC like so:

```rust
let rest_routes = Router::new().route(...);

// with `impl From<GrpcService> for Router`
let grpc_service = GrpcService::new(GrpcServiceImpl::new());

let app = Router::new()
    .merge(rest_routes)
    .merge(grpc_service);
```

## Honorable mentions

The following features weren't new in 0.5, but shipped recently and are worthy of
a shout out.

### `middleware::from_fn`

`axum` uses the [`tower::Service`] trait for middleware. However, it can be little
daunting to implement, mainly due to the lack of async traits in Rust.

But with [`axum::middleware::from_fn`] you can hide all that complexity and use a
familiar async function:

```rust
use axum::{
    Router,
    http::{Request, StatusCode},
    routing::get,
    response::IntoResponse,
    middleware::{self, Next},
};

async fn my_middleware<B>(
    req: Request<B>,
    next: Next<B>,
) -> impl IntoResponse {
    // transform the request...

    let response = next.run(request).await;

    // transform the response...

    response
}

let app = Router::new()
    .route("/", get(|| async { /* ... */ }))
    // add our middleware function
    .layer(middleware::from_fn(my_middleware));
```

The [documentation for middleware] has also been reworked, and goes into more
details about the different ways to write middleware, when to pick which
approach, how ordering works, and more.

### Type-safe routing

In `axum-extra`, we're experimenting with "type-safe routing". The idea is is to
establish a type-safe connection between a path and the corresponding handler.

Previously, it was possible to add a path like `/users` and apply a `Path<u32>`
extractor, which would always fail at runtime, since the path doesn't contain any
parameters.

We can use `axum-extra`'s type-safe routing to prevent that problem at compile-time:

```rust
use serde::Deserialize;
use axum::Router;
use axum_extra::routing::{
    TypedPath,
    RouterExt, // for `Router::typed_get`
};

// A type-safe path
#[derive(TypedPath, Deserialize)]
#[typed_path("/users/:id")]
struct UsersMember {
    id: u32,
}

// A regular handler function that takes `UsersMember` as the
// first argument and thus creates a typed connection between
// this handler and the `/users/:id` path.
async fn users_show(path: UsersMember) {
    tracing::info!(?path.id, "users#show called!");
}

let app = Router::new()
    // Add our typed route to the router.
    //
    // The path will be inferred to `/users/:id` since `users_show`'s
    // first argument is `UsersMember` which implements `TypedPath`
    .typed_get(users_show);
```

The key here is that our `users_show` function doesn't have any macros, so IDE
integration continues to work great.

See [`axum_extra::routing::TypedPath`] for more details.

## Updating

`axum` 0.5 also contains a few breaking changes, but I'd say they're all fairly
minor. Don't hesitate to reach out if you're having trouble upgrading or have
questions in general! You can find us in the `#axum` channel in the [Tokio Discord
server][discord].

<div style={{ textAlign: "right" }}>&mdash; David Pedersen (<a href="https://twitter.com/davidpdrsn">@davidpdrsn</a>)</div>

[documentation for middleware]: https://docs.rs/axum/latest/axum/middleware/index.html
[discord]: https://discord.gg/tokio
[`IntoResponseParts`]: https://docs.rs/axum/latest/axum/response/trait.IntoResponseParts.html
[`axum`]: https://crates.io/crates/axum
[`Extension`]: https://docs.rs/axum/latest/axum/struct.Extension.html
[`axum::response`]: https://docs.rs/axum/latest/axum/response/index.html
[`axum-extra`]: https://crates.io/crates/axum-extra
[`axum-core`]: https://crates.io/crates/axum-core
[`axum-macros`]: https://crates.io/crates/axum-macros
[`axum_extra::extract::cookie`]: https://docs.rs/axum-extra/latest/axum_extra/extract/cookie/index.html
[`HeaderMap`]: https://docs.rs/http/latest/http/header/struct.HeaderMap.html
[`Router::merge`]: https://docs.rs/axum/latest/axum/routing/struct.Router.html#method.merge
[`axum::middleware::from_fn`]: https://docs.rs/axum/latest/axum/middleware/fn.from_fn.html
[`axum_extra::routing::TypedPath`]: https://docs.rs/axum-extra/latest/axum_extra/routing/trait.TypedPath.html
[`CookieJar`]: https://docs.rs/axum-extra/latest/axum_extra/extract/cookie/struct.CookieJar.html
[`SignedCookieJar`]: https://docs.rs/axum-extra/latest/axum_extra/extract/cookie/struct.SignedCookieJar.html
[`tower::Service`]: https://docs.rs/tower/latest/tower/trait.Service.html
