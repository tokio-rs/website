---
date: "2021-05-27"
title: "Announcing tower-http"
description: "May 27, 2021"
---

Today I'm excited to announce [tower-http], which is a collection of HTTP
specific middleware and utilities built with Tower's [`Service`] trait.

Tower itself contains middleware that are all protocol agnostic. For example its
[timeout middleware] is compatible with any `Service` implementation regardless
of which protocol it uses. That is great because it means the middleware is more
reusable but it also means you cannot use protocol specific features. In the
case of HTTP it means none of the middleware in Tower knows about status codes,
headers, or other HTTP specific features.

tower-http on the other hand contains middleware that are specific to HTTP. It
uses the [http] and [http-body] crates meaning its compatible with any crate
that also uses those, such as [hyper], [tonic], and [warp].

The goal of tower-http is to provide a rich set of middleware for solving common
problems when building HTTP clients and servers. Some highlights are:

- [`Trace`]: Easily add high level tracing/logging to your application. Supports
  determining success or failure via status codes as well as gRPC specific
  headers. Has great defaults but also supports deep customization.
- [`Compression`] and [`Decompression`]: Automatically compress or decompress
  response bodies. This goes really well with serving static files using
  [`ServeDir`].
- [`FollowRedirect`]: Automatically follow redirection responses.

As well as several smaller utilities such as setting request and response
headers, hiding sensitive headers from logs, authorization, and more.

Building a little server with things from tower-http looks like this:

```rust
use tower_http::{
    compression::CompressionLayer,
    auth::RequireAuthorizationLayer,
    trace::TraceLayer,
};
use tower::{ServiceBuilder, make::Shared};
use http::{Request, Response};
use hyper::{Body, Error, server::Server};
use std::net::SocketAddr;

// Our request handler. This is where we would implement the application logic
// for responding to HTTP requests...
async fn handler(request: Request<Body>) -> Result<Response<Body>, Error> {
    Ok(Response::new(Body::from("Hello, World!")))
}

#[tokio::main]
async fn main() {
    // Use `tower`'s `ServiceBuilder` API to build a stack of middleware
    // wrapping our request handler.
    let service = ServiceBuilder::new()
        // High level tracing of requests and responses.
        .layer(TraceLayer::new_for_http())
        // Compress responses.
        .layer(CompressionLayer::new())
        // Authorize requests using a token.
        .layer(RequireAuthorizationLayer::bearer("tower-is-cool"))
        // Wrap a `Service` in our middleware stack.
        .service_fn(handler);

    // And run our service using `hyper`.
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    Server::bind(&addr)
        .serve(Shared::new(service))
        .await
        .expect("server error");
}
```

And building a client looks like this:

```rust
use tower_http::{
    decompression::DecompressionLayer,
    set_header::SetRequestHeaderLayer,
};
use tower::ServiceBuilder;
use hyper::Body;
use http::{Request, Response, HeaderValue, header::USER_AGENT};

let client = ServiceBuilder::new()
    // Log failed requests
    .layer(
        TraceLayer::new_for_http()
            .on_request(())
            .on_response(())
            .on_body_chunk(())
            .on_eos(())
            // leave the `on_failure` callback as the default
    )
    // Set a `User-Agent` header on all requests
    .layer(SetRequestHeaderLayer::<_, Body>::overriding(
        USER_AGENT,
        HeaderValue::from_static("my-app")
    ))
    // Decompress response bodies
    .layer(DecompressionLayer::new())
    // Wrap a `hyper::Client` in our middleware stack
    .service(hyper::Client::new());
```

We've put a lot of effort into the documentation and made sure everything has
examples that are easy to understand. We've also built two example applications,
one with [warp][warp-example] and the other with [tonic][tonic-example], which
show you how to put everything together.

Contributions are very welcome and if you have questions you can find us in the
[Tokio Discord] server.

<div style={{ textAlign: "right" }}>&mdash; David Pedersen (<a href="https://github.com/davidpdrsn">@davidpdrsn</a>)</div>

[tower-http]: https://github.com/tower-rs/tower-http
[`Service`]: https://docs.rs/tower/latest/tower/trait.Service.html
[Tower]: https://github.com/tower-rs/tower
[timeout middleware]: https://docs.rs/tower/latest/tower/timeout/struct.Timeout.html
[http]: https://crates.io/crates/http
[http-body]: https://crates.io/crates/http-body
[`Trace`]: https://docs.rs/tower-http/0.1.0/tower_http/trace/index.html
[`Compression`]: https://docs.rs/tower-http/0.1.0/tower_http/compression/index.html
[`Decompression`]: https://docs.rs/tower-http/0.1.0/tower_http/decompression/index.html
[`ServeDir`]: https://docs.rs/tower-http/latest/tower_http/services/struct.ServeDir.html
[`FollowRedirect`]: https://docs.rs/tower-http/latest/tower_http/follow_redirect/index.html
[warp-example]: https://github.com/tower-rs/tower-http/tree/master/examples/warp-key-value-store
[tonic-example]: https://github.com/tower-rs/tower-http/tree/master/examples/tonic-key-value-store
[Tokio Discord]: https://discord.gg/tokio
[hyper]: https://crates.io/crates/hyper
[tonic]: https://crates.io/crates/tonic
[warp]: https://crates.io/crates/warp
