---
date: "2021-07-30"
title: "Announcing Axum"
description: "July 30, 2021"
---

Today we are happy to announce [`axum`]: An easy to use, yet powerful, web framework
designed to take full advantage of the Tokio ecosystem.

# High level features

- Route requests to handlers with a macro free API.
- Declaratively parse requests using extractors.
- Simple and predictable error handling model.
- Generate responses with minimal boilerplate.
- Take full advantage of the [`tower`] and [`tower-http`] ecosystem of
  middleware, services, and utilities.

In particular the last point is what sets `axum` apart from existing frameworks.
`axum` doesn't have its own middleware system but instead uses
[`tower::Service`]. This means `axum` gets timeouts, tracing, compression,
authorization, and more, for free. It also enables you to share middleware with
applications written using [`hyper`] or [`tonic`].

# Usage examples

The "hello world" of `axum` looks like this:

```rust
use axum::prelude::*;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let app = route("/", get(root));

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    hyper::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn root() -> &'static str {
    "Hello, World!"
}
```

This will respond to `GET /` with a `200 OK` response where the body is `Hello,
World!`. Any other requests will result in a `404 Not Found` response.

## Extractors

Requests can be parsed declaratively using "extractors". An extractor is a type
that implements [`FromRequest`]. Extractors can be used as arguments to handlers
and will run if the request URI matches.

For example, [`Json`] is an extractor that consumes the request body and parses it
as JSON:

```rust
use axum::{prelude::*, extract::Json};
use serde::Deserialize;

#[derive(Deserialize)]
struct CreateUser {
    username: String,
}

async fn create_user(Json(payload): Json<CreateUser>) {
    // `payload` is a `CreateUser`
}

let app = route("/users", post(create_user));
```

`axum` ships with many useful extractors such as:

- [`Bytes`], `String`, [`Body`], and [`BodyStream`] for consuming the request body.
- [`Method`], [`HeaderMap`], and [`Uri`] for getting specific parts of the
  request.
- [`Form`], [`Query`], [`UrlParams`], and [`UrlParamsMap`] for more high level
  request parsing.
- [`Extension`] for sharing state across handlers.
- `Request<hyper::Body>` if you want full control.
- `Result<T, E>` and `Option<T>` to make an extractor optional.

You can also define your own by implementing [`FromRequest`].

## Building responses

Handlers can return anything that implements [`IntoResponse`] and it will
automatically be converted into a response:

```rust
use http::StatusCode;
use axum::response::{Html, Json};
use serde_json::{json, Value};

// We've already seen returning &'static str
async fn text() -> &'static str {
    "Hello, World!"
}

// String works too
async fn string() -> String {
    "Hello, World!".to_string()
}

// Returning a tuple of `StatusCode` and another `IntoResponse` will
// change the status code
async fn not_found() -> (StatusCode, &'static str) {
    (StatusCode::NOT_FOUND, "not found")
}

// `Html` gives a content-type of `text/html`
async fn html() -> Html<&'static str> {
    Html("<h1>Hello, World!</h1>")
}

// `Json` gives a content-type of `application/json` and works with any type
// that implements `serde::Serialize`
async fn json() -> Json<Value> {
    Json(json!({ "data": 42 }))
}
```

This means in practice you rarely have to build your own [`Response`]s. You can
also implement [`IntoResponse`] to create your own domain specific responses.

## Routing

Multiple routes can be combined using a simple DSL:

```rust
use axum::prelude::*;

let app = route("/", get(root))
    .route("/users", get(list_users).post(create_user))
    .route("/users/:id", get(show_user).delete(delete_user));
```

## Middleware

`axum` supports middleware from [`tower`] and [`tower-http`]:

```rust
use axum::prelude::*;
use tower_http::{compression::CompressionLayer, trace::TraceLayer};
use tower::ServiceBuilder;
use std::time::Duration;

let middleware_stack = ServiceBuilder::new()
    // timeout all requests after 10 seconds
    .timeout(Duration::from_secs(10))
    // add high level tracing of requests and responses
    .layer(TraceLayer::new_for_http())
    // compression responses
    .layer(CompressionLayer::new())
    // convert the `ServiceBuilder` into a `tower::Layer`
    .into_inner();

let app = route("/", get(|| async { "Hello, World!" }))
    // wrap our application in the middleware stack
    .layer(middleware_stack);
```

This feature is key as it allows us to write middleware once and share them
across applications. For example, `axum` doesn't have to provide its own
tracing/logging middleware, [`TraceLayer`] from [`tower-http`] can be used
directly. That same middleware can be also be used for clients or servers made
with [`tonic`].

## Routing to any [`tower::Service`]

`axum` can also route requests to any [`tower`] leaf service. Could be one you
write using [`service_fn`] or something from another crate, such as
[`ServeFile`] from `tower-http`:

```rust
use axum::{service, prelude::*};
use http::Response;
use std::convert::Infallible;
use tower::{service_fn, BoxError};
use tower_http::services::ServeFile;

let app = route(
    // Any request to `/` goes to a some `Service`
    "/",
    service::any(service_fn(|_: Request<Body>| async {
        let res = Response::new(Body::from("Hi from `GET /`"));
        Ok::<_, Infallible>(res)
    }))
).route(
    // GET `/static/Cargo.toml` goes to a service from tower-http
    "/static/Cargo.toml",
    service::get(ServeFile::new("Cargo.toml"))
);
```

## Learn more

This is just a small sample of what `axum` provides. Error handling, web
sockets, and parsing `multipart/form-data` requests are some features not shown
here. See the [docs] for more details.

We also encourage you to check out the [examples in the repo][examples] to see
some slightly larger applications written with `axum`.

As always, if you have questions you can find us in the [Tokio Discord] server.

<div style="text-align:right">&mdash; David Pedersen (<a href="https://github.com/davidpdrsn">@davidpdrsn</a>)</div>

[`axum`]: https://crates.io/crates/axum
[`tower`]: https://crates.io/crates/tower
[`tower-http`]: https://crates.io/crates/tower-http
[`tower::Service`]: https://docs.rs/tower/latest/tower/trait.Service.html
[`hyper`]: https://crates.io/crates/hyper
[`tonic`]: https://crates.io/crates/tonic
[docs]: https://docs.rs/axum
[examples]: https://github.com/tokio-rs/axum/tree/master/examples
[`FromRequest`]: https://docs.rs/axum/latest/axum/extract/trait.FromRequest.html
[`Json`]: https://docs.rs/axum/latest/axum/extract/struct.Json.html
[`IntoResponse`]: https://docs.rs/axum/latest/axum/response/trait.IntoResponse.html
[`service_fn`]: https://docs.rs/tower/latest/tower/fn.service_fn.html
[`ServeFile`]: https://docs.rs/tower-http/latest/tower_http/services/struct.ServeFile.html
[Tokio Discord]: https://discord.gg/tokio
[`Bytes`]: https://docs.rs/bytes/1.latest/bytes/struct.Bytes.html
[`Method`]: https://docs.rs/http/latest/http/method/struct.Method.html
[`HeaderMap`]: https://docs.rs/http/latest/http/header/struct.HeaderMap.html
[`BodyStream`]: https://docs.rs/axum/latest/axum/extract/struct.BodyStream.html
[`Body`]: https://docs.rs/axum/latest/axum/body/struct.Body.html
[`Form`]: https://docs.rs/axum/latest/axum/extract/struct.Form.html
[`TraceLayer`]: https://docs.rs/tower-http/latest/tower_http/trace/struct.TraceLayer.html
[`tonic`]: https://crates.io/crates/tonic
[`Uri`]: https://docs.rs/http/latest/http/uri/struct.Uri.html
[`Query`]: https://docs.rs/axum/latest/axum/extract/struct.Query.html
[`UrlParams`]: https://docs.rs/axum/latest/axum/extract/struct.UrlParams.html
[`UrlParamsMap`]: https://docs.rs/axum/latest/axum/extract/struct.UrlParamsMap.html
[`Response`]: https://docs.rs/http/latest/http/response/struct.Response.html
