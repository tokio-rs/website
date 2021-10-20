---
date: "2021-05-17"
title: "Inventing the Service trait"
description: "May 17, 2021"
---

[Tower] is a library of modular and reusable components for building robust
networking clients and servers.

At its core is the [`Service`] trait; its main role is to specify an
asynchronous function that accepts a request and returns a response. However,
some aspects of its design may not be immediately obvious. Rather than
explaining the `Service` trait as it exists in Tower today, let's look at the
motivation behind `Service` by imagining how you might invent it if you started
from scratch.

Imagine you are building a little HTTP framework in Rust. Your framework brings
a few constructs such as `HttpRequest` and `HttpResponse` and allow users to
easily implement an HTTP server by only supplying the code that receives a
request and replies with some response.

You expect your users to define such code as processing functions with the
following signature (yes, it is not async, but we will fix that later):

```rust
fn handle_request(request: HttpRequest) -> HttpResponse {
    // ...
}
```

Using your framework, a user would for instance implement

```rust
fn handle_request(request: HttpRequest) -> HttpResponse {
    if request.path() == "/" {
        HttpResponse::ok("Hello, World!")
    } else {
        HttpResponse::not_found()
    }
}
```

and then provide it to your framework's `Server::run` method simply as follows:

```rust
// Create a server that listens on port 3000
let server = Server::new("127.0.0.1:3000").await?;

// Somehow run the user's application
server.run(handle_request).await?;
```

Your framework provides this `Server::run` method:

```rust
impl Server {
    async fn run<F>(self, handler: F) -> Result<(), Error>
    where
        F: Fn(HttpRequest) -> HttpResponse,
    {
        let listener = TcpListener::bind(self.addr).await?;

        loop {
            let mut connection = listener.accept().await?;
            let request = read_http_request(&mut connection).await?;

            // Call the handler provided by the user
            let response = handler(request);

            write_http_response(connection, response).await?;
        }
    }
}
```

where you have chosen to delegate each request to the user's handler function
and write back the produced response somehow.

Expecting the user to provide a synchronous function is not too bad of a
design; at least it makes it easy for users to run HTTP servers without
worrying about any of the low-level details.

However, the server won't handle requests asynchronously. This is a major issue
if your user's function performs operations that are asynchronous in nature,
such as querying a database or sending a request to some other server. In such
cases, the entire server's loop is blocked (see [blocking]) while waiting for
the user's handler to produce a response.

Of course you want to provide your users with a server that can handle a large
number of concurrent connections, so the server needs the ability to serve
other requests while it waits for that request to complete asynchronously.

Let's improve your framework's design by having the handler be an asynchronous
function, meaning it returns a [future]:

```rust
impl Server {
    async fn run<F, Fut>(self, handler: F) -> Result<(), Error>
    where
        // `handler` now returns a generic type `Fut`...
        F: Fn(HttpRequest) -> Fut,
        // ...which is a `Future` whose `Output` is an `HttpResponse`
        Fut: Future<Output = HttpResponse>,
    {
        let listener = TcpListener::bind(self.addr).await?;

        loop {
            let mut connection = listener.accept().await?;
            let request = read_http_request(&mut connection).await?;

            // Await the future returned by `handler`
            let response = handler(request).await;

            write_http_response(connection, response).await?;
        }
    }
}
```

Users can now provide asynchronous handler functions which may perform some
asynchronous operations. For instance, your user would now write

```rust
// Now an async function
async fn handle_request(request: HttpRequest) -> HttpResponse {
    if request.path() == "/" {
        HttpResponse::ok("Hello, World!")
    } else if request.path() == "/important-data" {
        // We can now do async stuff in here
        let some_data = fetch_data_from_database().await;
        make_response(some_data)
    } else {
        HttpResponse::not_found()
    }
}
```

leaving unchanged the rest of your framework's API!

```rust
// Running the server remains the same
server.run(handle_request).await?;
```

This design is better but it still needs some refinement as your framework
currently forces your users to provide handler functions which never fail.

Let's then update the handler's signature to return a `Result<HttpResponse,
Error>` instead of a simple `HttpResponse`:

```rust
// User defines the body
async fn handle_request(request: HttpRequest) -> Result<HttpResponse, Error> { ... }
```

Your framework's `Server::run` method only needs a minor adjustment to handle
the potential errors returned:

```rust
impl Server {
    async fn run<F, Fut>(self, handler: F) -> Result<(), Error>
    where
        F: Fn(HttpRequest) -> Fut,
        // The response future is now allowed to fail
        Fut: Future<Output = Result<HttpResponse, Error>>,
    {
        let listener = TcpListener::bind(self.addr).await?;

        loop {
            let mut connection = listener.accept().await?;
            let request = read_http_request(&mut connection).await?;

            // Pattern match on the result of the response future
            match handler(request).await {
                Ok(response) => write_http_response(connection, response).await?,
                Err(error) => handle_error_somehow(error, connection),
            }
        }
    }
}
```

Job done.

# Adding more behavior

## Timeouts

As a framework author, you want to allow users to perform arbitrary
asynchronous operations. You cannot control though if some of their operations
make asynchronous calls and end up waiting indefinitely for some resource. So
your framework should offer the option of ensuring that requests do complete in
a timely manner or fail. Users willing to opt in that behavior would leverage
your framework even more.

You can do this by adding a _timeout_ to each request. A timeout sets a limit
on the maximum duration your user's handler should be waited for. If it doesn't
produce a response within some amount of time, the framework takes back control
and returns a specific error. This allows users of the framework to identify
this timeout case, and either retry the request or report an error to their own
user, rather than waiting indefinitely.

Your first idea might be to modify `Server` so that it can be configured with a
timeout. It would then apply that timeout every time it calls `handle_request`.
However, modifying `Server` is not the most flexible solution. A better way is
to add a new handler function to your framework, allowing users to opt in.

The following implementation uses [`tokio::time::timeout`] to call your user's
`handle_request` function, but with a timeout of 30 seconds:

```rust
async fn handler_with_timeout(request: HttpRequest) -> Result<HttpResponse, Error> {
    let result = tokio::time::timeout(
        Duration::from_secs(30),
        handle_request(request)  // <- user's function here
    ).await;

    match result {
        Ok(Ok(response)) => Ok(response),
        Ok(Err(error)) => Err(error),
        Err(_timeout_elapsed) => Err(Error::timeout()),
    }
}
```

This design provides a nice separation of concerns. We were able to add a
timeout without modifying any existing framework code.

## JsonContentType

Let's add one more feature to your framework using the same design. Imagine
your user is building a JSON API and therefore wants a `Content-Type:
application/json` header on all responses. Let's add to your framework a new
`handler_with_timeout_and_content_type` function which wraps the
`handler_with_timeout` function and modifies its response like so:

```rust
async fn handler_with_timeout_and_content_type(
    request: HttpRequest,
) -> Result<HttpResponse, Error> {
    let mut response = handler_with_timeout(request).await?;
    // actual timeouts have been returned at this point
    response.set_header("Content-Type", "application/json");
    Ok(response)
}
```

As a framework author, you have a choice here:

- You can design the `Server::run` method to call the above handler; this
  makes the framework now always present the following behavior to your users:
  they provide a handler that will process an HTTP request, but take no longer
  than 30 seconds, and always have the right `Content-Type` header.
- You can alternatively let users wrap their custom handler function with the
  new `handler_with_timeout_and_content_type`, and pass that your existing
  `Server::run` method.

Instead of making that choice now, let's take a step back, because these
hard-coded handlers would lead us into a rabbit hole.

We just added 2 composable behaviors to your framework:

- Without changing requirements on the user's `handle_request` function (it
  is still async, takes a `HttpRequest` and still returns a
  `Result<HttpResponse, Error>`.
- Without adding any code or complexity to the `Server`.

Designing frameworks in such a way is very powerful, since it allows users to
extend the library's functionality by layering in new behavior, without having
to wait for the library maintainers to add support for it.

It also makes testing easier, since you can break your code into small isolated
units and write fine-grained tests for them, without worrying about all the
other pieces.

# More flexible composition of behaviors

The current design composes behaviors via nesting (which is not a problem by
itself), but that nesting is currently hard-coded, so it lacks flexibility
(like composing two behaviors the other way around) and most importantly it
exposes you, the framework author, to the combinatorial explosion of those
composed behaviors when many new ones are added to your framework.

Let's start fresh with your current call chain:

1. `handler_with_timeout_and_content_type` accepts an `HttpRequest` and calls
2. `handler_with_timeout` accepts an `HttpRequest` and calls
3. `handle_request` is your user's handler function, it accepts an
   `HttpRequest` and actually processes it, maybe asynchronously

It would be nice if your user could somehow [compose] freely these three
functions. Something like:

```rust
let final_handler = with_content_type(with_timeout(handle_request));
// or possibly in a different order
```

while still being able to use the final handler in `Server::run` as simply as
before:

```rust
server.run(final_handler).await?;
```

A seemingly attractive implementation is to abstract away the functions' return
types behind an `impl Fn(HttpRequest) -> impl Future<Output =
Result<HttpResponse, Error>>`. For instance, you could try to implement
`with_content_type` and `with_timeout` as functions that

- took an argument of type `F: Fn(HttpRequest) -> Future<Output =
  Result<HttpResponse, Error>>`
- and returned a closure like `impl Fn(HttpRequest) -> impl Future<Output =
  Result<HttpResponse, Error>>`.

but that actually isn't possible due to limitations in where Rust allows `impl
Trait` today. Specifically `impl Fn() -> impl Future` is not allowed.

A known workaround this compiler limitation is to use `Box` for the return
type, but boxing allocates on each request, and with many behaviors allocating
on each request, this becomes a performance cost you would like to avoid.

You also wouldn't be able to add other behavior to your handlers besides calling
them but why that's necessary is something we'll get back to.

# The `Handler` trait

Let's approach this flexible composition in a different way. Rather than
`Server::run` accepting a closure (`Fn(HttpRequest) -> ...`), let's enrich your
framework with a new trait that encapsulates the same `async fn(HttpRequest) ->
Result<HttpResponse, Error>`:

```rust
trait Handler {
    async fn call(&mut self, request: HttpRequest) -> Result<HttpResponse, Error>;
}
```

An immediate convenience to your users is they can write concrete types that
implement that trait, so they don't have to deal with `Fn`s all the time.

However, Rust currently doesn't support async trait methods, so we have two
options:

1. Make the `call` method return a boxed future like `Pin<Box<dyn Future<Output =
   Result<HttpResponse, Error>>>`. This is what the [async-trait] crate does.
2. Add an associated `type Future` to the trait so users get to pick their own
   type.

Let's go with option two, as it's the most flexible. Users who have a concrete future
type can use that without the cost of a `Box`, and users who don't care can still
use `Pin<Box<...>>`.

```rust
trait Handler {
    type Future: Future<Output = Result<HttpResponse, Error>>;

    fn call(&mut self, request: HttpRequest) -> Self::Future;
}
```

As written above, the trait still satisfies the requirements of the
`Server::run` method because it requires that `Handler::Future` implements
`Future` with the output type `Result<HttpResponse, Error>`.

In addition, having `call` take `&mut self` is useful because it allows
handlers to update their internal state if necessary<sup>[1](#pin)</sup>.

With this new trait in the framework, let's imagine how a user would rewrite
their original `handle_request` function to implement the `Handler` trait:

```rust
struct RequestHandler;

impl Handler for RequestHandler {
    // We use `Pin<Box<...>>` here for simplicity, but could also define our
    // own `Future` type to avoid the overhead
    type Future = Pin<Box<dyn Future<Output = Result<HttpResponse, Error>>>>;

    fn call(&mut self, request: HttpRequest) -> Self::Future {
        Box::pin(async move {
            // same implementation as we had before
            if request.path() == "/" {
                Ok(HttpResponse::ok("Hello, World!"))
            } else if request.path() == "/important-data" {
                let some_data = fetch_data_from_database().await?;
                Ok(make_response(some_data))
            } else {
                Ok(HttpResponse::not_found())
            }
        })
    }
}
```

# Implementing `Timeout` and `JsonContentType` handlers

We're now left with figuring out the implementation of `Handler` for our two
existing framework behaviors: Timeout and JsonContentType.

Remember, the solution we're aiming for is one that allows us to compose
different pieces of functionality (behaviors) which each implement the
`Handler` trait and delegate to an object which implements that same trait.

## Implementing `timeout`

Let's proceed step by step and define a generic `Timeout` struct like this:

```rust
struct Timeout<T> {
    // T will be some type that implements `Handler`
    inner_handler: T,
    duration: Duration,
}
```

and then implement `Handler` for `Timeout<T>` (note that it delegates to `T`'s
`Handler` implementation via `self.inner_handler.call(request)`):

```rust
impl<T> Handler for Timeout<T>
where
    T: Handler,
{
    type Future = Pin<Box<dyn Future<Output = Result<HttpResponse, Error>>>>;

    fn call(&mut self, request: HttpRequest) -> Self::Future {
        Box::pin(async move {
            let result = tokio::time::timeout(
                self.duration,
                self.inner_handler.call(request), // <- delegation here
            ).await;

            match result {
                Ok(Ok(response)) => Ok(response),
                Ok(Err(error)) => Err(error),
                Err(_timeout) => Err(Error::timeout()),
            }
        })
    }
}
```

Let's explicitly mention a few things:

- The delegation line `self.inner_handler.call(request)` calls `inner_handler`
  which is bound to be a `Handler`, so we know its `call` method produces a
  future which if ever ready resolves into a `Result<HttpResponse, Error>`.
  That's all there is to it.
- By design `tokio::time::timeout` already awaits that future, so there is no
  need to await it directly in the `call` method of `Timeout<T>`.
- Because the future type is a `Pin<Box<dyn Future...>>` the call to
  `tokio::time::timeout` needs to be made in an async move block. More on
  this right after.
- By design `tokio::time::timeout` needs to express if the future was
  resolved before the timeout occurred, and it does so by returning its own
  Result which is an error if the timeout occurred before the future was ready.
  In order to hide that implementation detail and return the expected type for
  a `Handler::call` method, a match unpacks this specific result and has two
  error cases: if the call failed, or if it timed out.

The `Timeout<T>` implementation is not entirely correct yet because the `async
move` we mentioned above causes the following compiler error:

```
error[E0759]: `self` has an anonymous lifetime `'_` but it needs to satisfy a `'static` lifetime requirement
   --> src/lib.rs:145:29
    |
144 |       fn call(&mut self, request: HttpRequest) -> Self::Future {
    |               --------- this data with an anonymous lifetime `'_`...
145 |           Box::pin(async move {
    |  _____________________________^
146 | |             let result = tokio::time::timeout(
147 | |                 self.duration,
148 | |                 self.inner_handler.call(request),
...   |
155 | |             }
156 | |         })
    | |_________^ ...is captured here, requiring it to live as long as `'static`
```

The issue is that `&mut self` is captured and moved into the async block. That
means the lifetime of our future is tied to the lifetime of `&mut self`. This
doesn't work for us, since you might want your framework to run the response
futures on multiple threads to get better performance, or produce multiple
response futures and run them all in parallel. That isn't possible if a
reference to the handler lives inside the futures<sup>[2](#gats)</sup>.

Instead the `&mut self` needs to be converted into an owned `self`: exactly
what `Clone` does!

The following code provides an overview of your user's `RequestHandler` custom
code, and your framework's `Timeout` which wraps it. Simply note the new
requirement of your `Handler` trait: your users `Handler` implementations (and
your framework's) now have to implement `Clone`.

```rust
// User's code

// this must be `Clone` for `Timeout<T>` to be `Clone`
#[derive(Clone)]
struct RequestHandler;

impl Handler for RequestHandler {
    // ...
}

// Framework's code

#[derive(Clone)]
struct Timeout<T> {
    inner_handler: T,
    duration: Duration,
}

impl<T> Handler for Timeout<T>
where
    T: Handler + Clone,
{
    type Future = Pin<Box<dyn Future<Output = Result<HttpResponse, Error>>>>;

    fn call(&mut self, request: HttpRequest) -> Self::Future {
        // Get an owned clone of `&mut self`
        let mut this = self.clone();

        Box::pin(async move {
            let result = tokio::time::timeout(
                this.duration,
                this.inner_handler.call(request),
            ).await;

            match result {
                Ok(Ok(response)) => Ok(response),
                Ok(Err(error)) => Err(error),
                Err(_timeout) => Err(Error::timeout()),
            }
        })
    }
}
```

Don't worry about cloning: in this case it is very cheap since `RequestHandler`
doesn't have any data and `Timeout<T>` only adds a `Duration` (which is
`Copy`).

One step closer. We now get a different error:

```
error[E0310]: the parameter type `T` may not live long enough
   --> src/lib.rs:149:9
    |
140 |   impl<T> Handler for Timeout<T>
    |        - help: consider adding an explicit lifetime bound...: `T: 'static`
...
149 | /         Box::pin(async move {
150 | |             let result = tokio::time::timeout(
151 | |                 this.duration,
152 | |                 this.inner_handler.call(request),
...   |
159 | |             }
160 | |         })
    | |__________^ ...so that the type `impl Future` will meet its required lifetime bounds
```

The problem is that, even though `T` has bounds for `Handler + Clone`, it could
still be a type that contains references, like `Vec<&'a str>`. This can't work
for the same reason as the previous error.

The response future simply needs to have a `'static` lifetime so it can easily
passed around: the compiler actually told us what the fix is. Add `T: 'static`:

```rust
impl<T> Handler for Timeout<T>
where
    T: Handler + Clone + 'static,
{
    // ...
}
```

The response future now satisfies the `'static` lifetime requirement, since it
doesn't contain references (or any references `T` might contain are `'static`).
Now, this part of your framework compiles!

For reference, the corrected code is

```rust
// User's code

// this must be `Clone` for `Timeout<T>` to be `Clone`
#[derive(Clone)]
struct RequestHandler;

impl Handler for RequestHandler {
    // ...
}

// Framework's code

#[derive(Clone)]
struct Timeout<T> {
    inner_handler: T,
    duration: Duration,
}

impl<T> Handler for Timeout<T>
where
    T: Handler + Clone + 'static,
{
    type Future = Pin<Box<dyn Future<Output = Result<HttpResponse, Error>>>>;

    fn call(&mut self, request: HttpRequest) -> Self::Future {
        // Get an owned clone of `&mut self`
        let mut this = self.clone();

        Box::pin(async move {
            let result = tokio::time::timeout(
                this.duration,
                this.inner_handler.call(request),
            ).await;

            match result {
                Ok(Ok(response)) => Ok(response),
                Ok(Err(error)) => Err(error),
                Err(_timeout) => Err(Error::timeout()),
            }
        })
    }
}
```

## Implementing `JsonContentType`

Let's proceed similarly to create your framework's handler struct which adds a
`Content-Type` header on the response:

```rust
#[derive(Clone)]
struct JsonContentType<T> {
    inner_handler: T,
}

impl<T> Handler for JsonContentType<T>
where
    T: Handler + Clone + 'static,
{
    type Future = Pin<Box<dyn Future<Output = Result<HttpResponse, Error>>>>;

    fn call(&mut self, request: HttpRequest) -> Self::Future {
        let mut this = self.clone();

        Box::pin(async move {
            let mut response = this.inner_handler.call(request).await?;
            response.set_header("Content-Type", "application/json");
            Ok(response)
        })
    }
}
```

Notice how similar  to `Timeout` this pattern is.

## Modifying `Server::run` for the updated `Handler` trait

The last piece of code to update is the `Server::run` in order to accept the new
`Handler` trait, and now your framework compiles.

```rust
impl Server {
    async fn run<T>(self, mut handler: T) -> Result<(), Error>
    where
        T: Handler,
    {
        let listener = TcpListener::bind(self.addr).await?;

        loop {
            let mut connection = listener.accept().await?;
            let request = read_http_request(&mut connection).await?;

            // have to call `Handler::call` here
            match handler.call(request).await {
                Ok(response) => write_http_response(connection, response).await?,
                Err(error) => handle_error_somehow(error, connection),
            }
        }
    }
}
```

Your users can now compose their handler with the two handlers your framework
provides:

```rust
JsonContentType {
    inner_handler: Timeout {
        inner_handler: RequestHandler,
        duration: Duration::from_secs(30),
    },
}
```

As the above feels a little bit raw, maybe your framework should also provide
`new` methods to its `Timeout<T>` and `JsonContentType` handlers:

```rust
let handler = RequestHandler; // your user's handler
let handler = Timeout::new(handler, Duration::from_secs(30));
let handler = JsonContentType::new(handler);

// `handler` has type `JsonContentType<Timeout<RequestHandler>>`

server.run(handler).await
```

This works quite well! Users of your framework are now able to layer on
additional functionality to their `RequestHandler` without having to modify its
implementation. In theory, if your framework became large, you could decide to
split out some related handlers into their own crate and release it on
crates.io!

# Making `Handler` more flexible

Your `Handler` trait is now working quite nicely for your users, but it
currently only supports your `HttpRequest` and `HttpResponse` types. It would
be even nicer the trait was generic over those types, so users could provide
whatever types they want: Request and Response types for other protocols than
HTTP.

In the updated trait below, `Request` is a type parameter because it is freely
chosen by your user, however the `Response` is an associated type because for
any _given_ request type, there can only be one (associated) response type: the
one the corresponding call returns!

When facing such design decisions, think of how many degrees of freedom you
have: in this case, for a given protocol, there is only one request type, and
one response type, one has to be the parameter, and the dependent type has to
be associated. As an alternative, the trait could have been generic over
another type, the Protocol (if such type existed in your framework) and the
trait would have had both the `Request` and `Response` as associated types,
however we thought this choice introduces an additional type (Protocol) which
we think does not bring much additional value. So here you are with just one
type parameter, the request, and one associated response type.

```rust
trait Handler<Request> {
    type Response;

    // Error should also be an associated type. No reason for that to be a
    // hard-coded type
    type Error;

    // Our future type from before, but now it's output must use
    // the associated `Response` and `Error` types
    type Future: Future<Output = Result<Self::Response, Self::Error>>;

    // `call` is unchanged, but note that `Request` here is our generic
    // `Request` type parameter and not the `HttpRequest` type we've used
    // until now
    fn call(&mut self, request: Request) -> Self::Future;
}
```

With this trait in your framework, this is how one of your user would implement
their `RequestHandler` for the HTTP protocol:

```rust
impl Handler<HttpRequest> for RequestHandler {
    type Response = HttpResponse;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<HttpResponse, Error>>>>;

    fn call(&mut self, request: Request) -> Self::Future {
        // same as before
    }
}
```

We hope you agree this is not much added complexity to your users.

The rest of your framework has to be adjusted slightly. Starting with
`Timeout<T>`.

Since `Timeout<T>` wraps some other type `T` which implements `Handler`, it
actually doesn't care about what the request or response types are, as long as
the `Handler` it wraps uses the same types. So `Timeout` will remain generic
over one type: its wrapped `Handler` called `T`. However, the implementation of
`Handler<R>` for `Timeout<T>` has to drive the correct types through. Consider
the following while looking at the code below:

- As in the previous implementation, the `Error` type still has to be handled
  specifically since `tokio::time::timeout` returns `Result<T,
  tokio::time::error::Elapsed>`. The implementation must then be able to
  convert a `tokio::time::error::Elapsed` into the inner `Handler`'s error
  type. For this reason, the where bound specifies `T::Error:
  From<tokio::time::error::Elapsed>`.
- For the same reason, the error type returned by `Timeout` must be the same
  type as the one of its wrapped handler: so the associated error type must be:
  `T::Error` and the match code performs that conversion.
- The exact same goes for the associated response type; it must be
  `T::Response` and `Timeout<T>::call` has to return a future to a result of
  a `T::Response`.
- As before, the request of type `R` will be moved inside the async block and
  thus should not contain any references: it must then be `'static`.

If we put all those things together we get

```rust
// `Timeout` accepts any request of type `R` as long as `T`
// accepts the same type of request
impl<R, T> Handler<R> for Timeout<T>
where
    // As with the previous implementation, the actual
    // type of request must not contain references.
    // The compiler would tell us to add this anyway.
    R: 'static,

    // `T` must accept requests of type `R`
    T: Handler<R> + Clone + 'static,

    // We must be able to convert an `Elapsed` into
    // `T`'s error type
    T::Error: From<tokio::time::error::Elapsed>,
{
    // Our response type is the same as `T`'s, since we
    // don't have to modify it
    type Response = T::Response;

    // Error type is also the same
    type Error = T::Error;

    // Future must output a `Result` with the correct types
    type Future = Pin<Box<dyn Future<Output = Result<T::Response, T::Error>>>>;

    fn call(&mut self, request: R) -> Self::Future {
        let mut this = self.clone();

        Box::pin(async move {
            let result = tokio::time::timeout(
                this.duration,
                this.inner_handler.call(request),
            ).await;

            match result {
                Ok(Ok(response)) => Ok(response),
                Ok(Err(error)) => Err(error),
                Err(elapsed) => {
                    // Convert the error
                    Err(T::Error::from(elapsed))
                }
            }
        })
    }
}
```

Now the implementation of `Timeout<T>` is correct, let's switch to
`JsonContentType`.

Consider the following while reading the code below:

- This handler cannot fail, but as it implements your `Handler` trait, it must
  still return a future to a result of a `Response`. This is implemented by
  returning inconditionally an `Ok(response)`.
- This response is modified via a call to `set_header` (did you notice the
  `let mut response`?); a method that only exists on `HttpResponse`. Indeed,
  that handler has no requirements on the request or error types but it needs
  the response type to be `HttpResponse`. This is why the response associated
  type is bound to be `HttpResponse`.
- If you look closer at the associated `Future` type, you will see that this
  time (as opposed to `Timeout<T>`) the result type is the parameter
  `Response`. We could have written equivalently `T::Response` or
  `HttpResponse` because they're all the same here.
- The implementation is generic over the request type, but let's be honest,
  which other kind of request than `HttpRequest` could ever return a
  `HttpResponse`? ;) In the present case we use the parameter `R` to bind
  `'static`, but it's very likely that using `HttpRequest` (which you designed
  in your framework as not containing any references) would work just as well.

The implementation is:

```rust
// Again a generic request type
impl<R, T> Handler<R> for JsonContentType<T>
where
    R: 'static,
    // `T` must accept requests of any type `R` and return
    // responses of type `HttpResponse`
    T: Handler<R, Response = HttpResponse> + Clone + 'static,
{
    type Response = HttpResponse;

    // Our error type is whatever `T`'s error type is
    type Error = T::Error;

    type Future = Pin<Box<dyn Future<Output = Result<Response, T::Error>>>>;

    fn call(&mut self, request: R) -> Self::Future {
        let mut this = self.clone();

        Box::pin(async move {
            let mut response = this.inner_handler.call(request).await?;
            response.set_header("Content-Type", "application/json");
            Ok(response)
        })
    }
}
```

The last piece of your framework that needs a slight update is the
`Server::run` method. In the present case, we decide that the `Server` is
purely a HTTP server so the `Handler` that your users pass to it must use
`HttpRequest` and `HttpResponse`:

```rust
impl Server {
    async fn run<T>(self, mut handler: T) -> Result<(), Error>
    where
        T: Handler<HttpRequest, Response = HttpResponse>,
    {
        // ...
    }
}
```

For users of your framework, after they have implemented their own
`RequestHandler` as shown previously, there is no change on the call site:

```rust
let handler = RequestHandler;
let handler = Timeout::new(handler, Duration::from_secs(30));
let handler = JsonContentType::new(handler);

server.run(handler).await
```

So, we now have a `Handler` trait that makes it possible to break our
application up into small independent parts and re-use them. Not bad!

# Why renaming the `Handler` trait to `Service` makes sense

Until now, we've only talked about the server side of things. But, your
`Handler` trait actually fits HTTP clients as well where a client implementing
`Handler` accepts some request and asynchronously sends it over the network.
Your `Timeout` handler can definitely be used here as well. `JsonContentType`
probably isn't, since it's not the clients job to set response headers.

Since the `Handler` trait is useful for defining both servers and clients, but
clients do not "handle" requests, `Handler` probably isn't an appropriate name.

The canonical term for software which processes requests or responses between
the reception point and the processing point is "Middleware", and in
particular, `Timeout` and `JsonContentType` are composable bits of middleware.
There are many others in Tower, each providing some kind of "service", for
instance logging, reconnection, load balancing. The term "Service" sticked.

Let's then rename your `Handler` trait to `Service`:

```rust
trait Service<Request> {
    type Response;
    type Error;
    type Future: Future<Output = Result<Self::Response, Self::Error>>;

    fn call(&mut self, request: Request) -> Self::Future;
}
```

This is actually _almost_ the `Service` trait defined in Tower. If you've been
following along you now understand most of Tower. Besides the `Service` trait,
Tower also provides several utilities that implement `Service` by wrapping some
other type that also implements `Service`, exactly like we did with `Timeout`
and `JsonContentType`. These services can be composed in ways similar to what
we've done thus far.

Some example services provided by Tower:

- [`Timeout`] - This is pretty much identical to the timeout we have built.
- [`Retry`] - To automatically retry failed requests.
- [`RateLimit`] - To limit the number of requests a service will receive over a
  period of time.

Various Software Patterns are used in Tower services:

- Decorators wrap an object and enrich its behavior while keeping the same
  interface: for instance, `Timeout` decorates its wrapped service.
- Adapters are used in various places: for instance, inside `Timeout` the
  result type from `tokio::time::timeout` is adapted to the result type the
  `Service::call` method.
- And several others.

User-provided types like `RequestHandler` are typically called _leaf services_,
since they sit at the leaves of a tree of nested services. The actual responses
are normally produced in leaf services and modified by middleware.

The only thing left to talk about is _backpressure_ and [`poll_ready`].

# Backpressure

## The problem

Imagine you wanted to write a rate limit middleware that wraps a `Service` and
puts a limit on the maximum number of concurrent requests the underlying service
will receive. This would be useful if you had some service that had a hard upper
limit on the amount of load it could handle.

With your current `Service` trait, you don't really have a good way to implement
such rate limiting. You could try:

```rust
impl<R, T> Service<R> for ConcurrencyLimit<T> {
    fn call(&mut self, request: R) -> Self::Future {
        // 1. Check a counter for the number of requests currently being
        //    processed.
        // 2. If there is capacity left send the request to `T`
        //    and increment the counter.
        // 3. If not somehow wait until capacity becomes available.
        // 4. When the response has been produced, decrement the counter.
    }
}
```

In this scenario, if there was no capacity left, the code would have to wait
and somehow get notified when capacity becomes available. Additionally, it
would have to keep the request in memory while waiting (also called _buffering_
the request). This means that the more requests are waiting for capacity, the
more memory your user's program would use --- if more requests are produced
than our service can handle, they might even run out of memory! It would be
more robust to only allocate space for the request when it is certain that the
service has capacity to handle it.

Let's sketch and discuss a solution to this. It would be nice if `Service` had
a method similar to this (the final method is presented after):

```rust
trait Service<R> {
    async fn ready(&mut self);
}
```

In this scenario, `ready` would be an async function that completes when the
service has capacity enough to receive one new request. Of course, the
semantics are correct only if `service.ready().await` is called before
`service.call(request).await`, but this can be enforced:

- on your types by your framework
- on user types by qualifying a misuse as API contract violation and allowing
  your framework types to `panic` if `call`ed when not ready.

Imagine a new service which implements that design: `ConcurrencyLimit`. It
tracks capacity inside the `ready` function and prevents users from calling
`call` until there is sufficient capacity.

Separating "calling the service" from "reserving capacity" also unlocks new use
cases, such as being able to maintain a set of "ready services" that your
framework keeps up to date in the background, such that any new request already
has a service ready to process it without entering the `call` method and wait
for readiness first.

Other services that don't care about capacity could just return immediately from
the call to `ready`, or if they wrap some inner `Service`, they could delegate to its
`ready` method.

That would be ideal, but... Rust does not yet allow defining async functions
inside traits.

Earlier, we already faced that same situation with the `Service::call`
method; it also could not be directly declared as an async function within the
`Service` trait. The solution was to make the `Service::call` a sync function
which returns its own Future type and make that type an associated type to the
`Service` trait.

If an async function is really needed, this is the best solution right now and
still offers a choice: either pay the cost of a `Box::Pin` allocation for each
request, or force the service's author (you or your user) to declare a custom
future type --- we did not illustrate that solution in this tutorial for
brevity, but rest assured that Tower does exactly that for its services.

The question is: does the `ready` function actually needs to be async?

If it does need to be async, you can apply that same "custom future type"
solution. As before however this leaks into the trait declaration, and is a bit
cumbersome because of the extra development effort for _every_ service.

You will see next why `ready` needs not being async and why Tower adopted it.

## Tower's solution

Taking some inspiration from the `Future` trait, your framework (and Tower)
define a _synchronous_ method called `poll_ready`:

```rust
use std::task::{Context, Poll};

trait Service<R> {
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<()>;
}
```

If the service is out of capacity, `poll_ready` returns `Poll::Pending` and
will notify the caller using the waker from the `Context` when capacity becomes
available. At that point, `poll_ready` can be called again and returns
`Poll::Ready(())` indicating the capacity is reserved and `call` can be
called.

There is still the caveat that nothing technically prevents users from calling
`call` without first making sure the service is ready. However, we gave our
line of thinking in the previous section: enforce correct use in your framework
types, and `panic` if `call` is called on a service that isn't ready.

The `poll_ready` method not returning a `Future` also means you're able to
quickly check if a service is ready without being forced to wait for it to
become ready. If you call `poll_ready` and get back a `Poll::Pending`, you
can simply decide to do something else instead of waiting. Among other things,
this allows you to build load balancers that estimate the load of services by
how often they return `Poll::Pending`, and send requests to the service with
the least load.

Note that it is still possible get a `Future` that resolves when capacity is
available using something like [`futures::future::poll_fn`] or the
[`tower::ServiceExt::ready`] method.

This concept of services communicating with their callers about their capacity
is called "backpressure propagation". You can think of it as services pushing
back on their callers, and telling them to slow down if they're producing
requests too fast. The fundamental idea is that you shouldn't send a request to
a service that doesn't have the capacity to handle it. Instead you should
either wait (buffering), drop the request (load shedding), or handle the lack
of capacity in some other way. You can learn more about the general concept of
backpressure [here][backpressure] and [here][backpressure2].

Finally, because it might also be possible for some error to happen while
reserving capacity, `poll_ready` probably should return `Poll<Result<(),
Self::Error>>`.

With this last change we've finally reached the complete definition of the
`tower::Service` trait:

```rust
pub trait Service<Request> {
    type Response;
    type Error;
    type Future: Future<Output = Result<Self::Response, Self::Error>>;

    fn poll_ready(
        &mut self,
        cx: &mut Context<'_>,
    ) -> Poll<Result<(), Self::Error>>;

    fn call(&mut self, req: Request) -> Self::Future;
}
```

Backpressure in middleware does enable some interesting use cases, such as
various kinds of rate limiting, load balancing, and auto scaling.

In Tower, many middleware services actually don't need their own backpressure
mechanism, but they do delegate to the wrapped service's `poll_ready` method
implementation. **If you omitted calling a service's `poll_ready` method, none
of the wrapped service would be guaranteed to be ready, effectively disabling
the entire backpressure mechanism**. We then strongly advise you to call
`poll_ready` systematically.

With all this in place, the most common way to call a service is:

```rust
use tower::{
    Service,
    // for the `ready` method to return a future
    ServiceExt,
};

let response = service
    // wait for the service to have capacity
    .ready().await?
    // send the request
    .call(request).await?;
```

<div style="text-align:right">&mdash; David Pedersen (<a href="https://github.com/davidpdrsn">@davidpdrsn</a>)</div>

---

# Footnotes

<a name="pin">1</a>: There has been some discussion around whether `call` should
take `Pin<&mut Self>` or not, but so far we've decided to go with a plain `&mut
self` which means handlers (ahem, _services_) must be `Unpin`. In practice that is
rarely an issue. More details [here](https://github.com/tower-rs/tower/issues/319).

<a name="gats">2</a>: To be a bit more precise, the reason this requires the
response future to be `'static` is that writing `Box<dyn Future>` actually
becomes `Box<dyn Future + 'static>`, which the anonymous lifetime in `fn
call(&'_ mut self, ...)` doesn't satisfy. In the future, the Rust compiler team
plans to add a feature called [generic associated types][gat] which will let us
get around this. Generic associated types will allow us to define the response
future as `type Future<'a>`, and `call` as `fn call<'a>(&'a mut self, ...) ->
Self::Future<'a>` but for now response futures must be `'static`.

[`RateLimit`]: https://docs.rs/tower/latest/tower/limit/rate/index.html
[`Retry`]: https://docs.rs/tower/latest/tower/retry/index.html
[`Service`]: https://docs.rs/tower/latest/tower/trait.Service.html
[`Timeout`]: https://docs.rs/tower/latest/tower/timeout/index.html
[`futures::future::poll_fn`]: https://docs.rs/futures/0.3.14/futures/future/fn.poll_fn.html
[`poll_ready`]: https://docs.rs/tower/0.4.7/tower/trait.Service.html#tymethod.poll_ready
[`tokio::time::timeout`]: https://docs.rs/tokio/latest/tokio/time/fn.timeout.html
[`tower::ServiceExt::ready`]: https://docs.rs/tower/0.4.7/tower/trait.ServiceExt.html#method.ready
[async-trait]: https://crates.io/crates/async-trait
[backpressure2]: https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/
[backpressure]: https://medium.com/@jayphelps/backpressure-explained-the-flow-of-data-through-software-2350b3e77ce7
[blocking]: https://ryhl.io/blog/async-what-is-blocking/
[compose]: https://en.wikipedia.org/wiki/Function_composition
[dropping]: https://doc.rust-lang.org/stable/std/ops/trait.Drop.html
[future]: https://doc.rust-lang.org/stable/std/future/trait.Future.html
[gat]: https://github.com/rust-lang/rust/issues/44265
[Tower]: https://github.com/tower-rs/tower
