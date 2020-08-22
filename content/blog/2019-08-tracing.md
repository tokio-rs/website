---
date: "2019-08-14"
title: "Diagnostics with Tracing"
description: "August 14, 2019"
---

Effectively developing systems and operating them in production requires
visibility into their behavior at runtime. While conventional logging can
provide some of this visibility, asynchronous software &mdash; like applications
using the Tokio runtime &mdash; introduces new challenges.

[`tracing`][tracing-crates] is a collection of libraries that provide a
framework for instrumenting Rust programs to collect structured, context-aware,
event driven diagnostics. Note that `tracing` was originally released under the
name `tokio-trace`; the name was changed to reflect that, although it is part of
the Tokio project, the `tokio` runtime is not required to use `tracing`.

## Why do we need another logging library?

Rust already has a robust logging ecosystem based around the [log][log-crates]
crate's logging facade, with libraries such as `env_logger` and `fern` in
widespread use. This raises reasonable questions&ndash; why is `tracing`
necessary, and what benefit does it provide that existing libraries don't? To
answer these questions, we need to consider the challenges introduced by
diagnostics in asynchronous systems.

In synchronous code, we can simply log individual messages as the program
executes, and expect them to be printed in order. A programmer can interpret the
logs fairly easily, since the log records are output sequentially. For example,
in a synchronous system, if I see a group of log messages like this:

```plain
DEBUG server: accepted connection from 106.42.126.8:56975
DEBUG server::http: received request
 WARN server::http: invalid request headers
DEBUG server: closing connection
```

I can infer that the request from the client with the IP address 106.42.126.8
was the one that failed, and that the connection from that client was then
closed by the server. The _context_ is implied by previous messages: because the
synchronous server must serve each request before accepting the next connection,
we can determine that any log records occurring after an "accepted
connection..." message and before a "closing connection" message refer to that
connection.

However, in asynchronous systems like Tokio, interpreting traditional log
messages can often be quite challenging. A single thread in an asynchronous
system might be executing any number of tasks, switching between them as IO
resources become available, and an application might consist of a number of such
worker threads running concurrently. In this world, we can no longer rely on the
ordering of log messages to determine context or cause and effect. A task might
log some messages and yield, allowing the executor to poll another task that
logs its own unrelated messages. Log messages from threads running concurrently
might be printed out interleaved. To understand asynchronous systems, the
contextual and causal relationships must be recorded explicitly, rather than
implied by sequential ordering.

If the log lines in the above example were emitted by a asynchronous
application, the server task may continue accepting new connections while
previously-accepted ones are being processed by other tasks; multiple requests
might be processed concurrently by worker threads. We might see something like
this:

```plain
DEBUG server: accepted connection from 106.42.126.8:56975
DEBUG server: closing connection
DEBUG server::http: received request
DEBUG server: accepted connection from 11.103.8.9:49123
DEBUG server::http: received request
DEBUG server: accepted connection from 102.12.37.105:51342
 WARN server::http: invalid request headers
TRACE server: closing connection
```

We don't know that the request with invalid headers was received from
106.42.126.8 any longer. Since multiple connections are being processed
concurrently, the invalid headers might have been sent on another connection
while we waited to receive more data from that client. What can we do to make
sense of this mess?

Conventional logging often captures _static_ contexts about the program &mdash;
such as what file, module, or function an event was recorded in &mdash; but
that's of limited use to us in understanding the program's runtime behavior.
Instead, visibility into asynchronous code requires diagnostics that track the
_dynamic_ runtime contexts in which events occur.

## Application-Level Tracing

`tracing` is more than a logging library: it implements scoped, contextual, and
structured diagnostic instrumentation. This allows users to trace logical
contexts in the application through time, even as the actual flow of execution
moves between those contexts.

### Spans

To record the flow of execution, `tracing` introduces the concept of _spans_.
Unlike a log line that represents a moment in time, a span models a period of
time with a beginning and an end. When a program begins executing in a context
or performing a unit of work, it _enters_ a span, and when it stops executing in
that context, it _exits_ the span.

Any events that occur between when a span is entered and when it is exited are
considered to have occurred within that span. Similarly, spans may be nested:
when a thread enters a span inside of another span, it is in **both** spans,
with the newly-entered span considered the _child_ and the outer span the
_parent_. We can then construct a tree of nested spans and follow them
throughout different parts of a program.

`tracing` also supports _events_, which model instantaneous points in time.
Events are similar to traditional log messages, but exist within the tree of
spans as well. When we record an event, we can pinpoint the context in which it
occurred.

### Structure

By attaching _structured data_ to spans, we can model contexts. Rather than
simply recording unstructured, human-readable messages, `tracing`
instrumentation points record typed key-value data called _fields_. For example,
in an HTTP server, a span representing an accepted connection might record
fields such as the client's IP address, the requested path, request method,
headers, and so on. If we revisit the example above, with the addition of spans,
we might see something like this:

```plain
DEBUG server{client.addr=106.42.126.8:56975}: accepted connection
DEBUG server{client.addr=82.5.70.2:53121}: closing connection
DEBUG server{client.addr=89.56.1.12:55601} request{path="/posts/tracing" method=GET}: received request
DEBUG server{client.addr=111.103.8.9:49123}: accepted connection
DEBUG server{client.addr=106.42.126.8:56975} request{path="/" method=PUT}: received request
DEBUG server{client.addr=113.12.37.105:51342}: accepted connection
 WARN server{client.addr=106.42.126.8:56975} request{path="/" method=PUT}: invalid request headers
TRACE server{client.addr=106.42.126.8:56975} request{path="/" method=PUT}: closing connection
```

Notice how the events are annotated with spans that record the client IP
address, and the request's path and method. Although multiple events are
happening concurrently in different contexts, we can now follow the flow of the
request from 106.42.126.8 through the system, and determine that it was the
request containing the invalid headers that generated the warning.

This machine-readable structured data also gives us the ability to consume
diagnostic data in more sophisticated ways than simply formatting it to be read
by a human. For example, we might also consume the above data by counting the
number of requests recieved for different paths or HTTP methods. By looking at
the structure of the span tree as well as at key-value data, we can even do
things like recording the entire lifespan of a request only when it ended with
an error.

## A Worked Example

To demonstrate the value of this kind of diagnostics, let's take a look at an
example. In this example, we've written a small HTTP service, using [`tower`],
that implements "character repetition as a service". The service recieves
requests for paths consisting of a single ASCII character, and responds with
that character duplicated a number of times equal to the value of the
`Content-Length` header.

We've instrumented the example service using `tracing`, and used the
[`tracing-subscriber`] crate to implement an admin endpoint that allows us to
[change the filter configuration][reload] that determines what `tracing`
instrumentation is enabled at runtime. A load generator runs in the background
that constantly sends requests for random alphabetic characters to the demo
service.

With a version of the example service instrumented using the [`log`][log-crates]
and [`env_logger`] crates, we get output like this:

```log
...
[DEBUG load_log] accepted connection from [::1]:55257
[DEBUG load_log] received request for path "/z"
[DEBUG load_log] accepted connection from [::1]:55258
[DEBUG load_log] received request for path "/Z"
[ERROR load_log] error received from server! status: 500
[DEBUG load_log] accepted connection from [::1]:55259
[DEBUG load_log] accepted connection from [::1]:55260
[DEBUG load_log] received request for path "/H"
[DEBUG load_log] accepted connection from [::1]:55261
[DEBUG load_log] received request for path "/S"
[DEBUG load_log] received request for path "/C"
[DEBUG load_log] accepted connection from [::1]:55262
[DEBUG load_log] received request for path "/x"
[DEBUG load_log] accepted connection from [::1]:55263
[DEBUG load_log] accepted connection from [::1]:55264
[WARN  load_log] path "/" not found; returning 404
[DEBUG load_log] accepted connection from [::1]:55265
[ERROR load_log] error received from server! status: 404
[DEBUG load_log] received request for path "/Q"
[DEBUG load_log] accepted connection from [::1]:55266
[DEBUG load_log] received request for path "/l"
...
```

Because the service is under load, these messages scroll past very fast. I've
included just a small sample of the output here.

Although the errors do show up in the logs, it's difficult to associate them
with any context that might help us determine their cause. For the 404 error,
we're lucky enough that whomever added the warning line logged by the server
thought to include the path in the human-readable log message, but for the 500
error, we're flying blind.

Now, let's switch to a version of the demo application that's instrumented with
`tracing`:

```log
...
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60891}: load: accepted connection
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60890}: load: accepted connection
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60891}:request{req.method=GET req.path="/I"}: load: received request. req.headers={"content-length": "18", "host": "[::1]:3000"} req.version=HTTP/1.1
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60890}:request{req.method=GET req.path="/T"}: load: received request. req.headers={"content-length": "4", "host": "[::1]:3000"} req.version=HTTP/1.1
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60892}: load: accepted connection
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60892}:request{req.method=GET req.path="/x"}: load: received request. req.headers={"content-length": "6", "host": "[::1]:3000"} req.version=HTTP/1.1
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60893}: load: accepted connection
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60895}:request{req.method=GET req.path="/"}: load: received request. req.headers={"content-length": "13", "host": "[::1]:3000"} req.version=HTTP/1.1
 WARN server{name=serve local=[::1]:3000}:conn{remote=[::1]:60895}:request{req.method=GET req.path="/"}: load: rsp.status=404
ERROR gen: error received from server! status=404
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60893}:request{req.method=GET req.path="/a"}: load: received request. req.headers={"content-length": "11", "host": "[::1]:3000"} req.version=HTTP/1.1
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60894}: load: accepted connection
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60894}:request{req.method=GET req.path="/V"}: load: received request. req.headers={"content-length": "12", "host": "[::1]:3000"} req.version=HTTP/1.1
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60896}: load: accepted connection
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60998}: load: accepted connection
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60996}:request{req.method=GET req.path="/z"}: load: received request. req.headers={"content-length": "17", "host": "[::1]:3000"} req.version=HTTP/1.1
ERROR gen: error received from server! status=500
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60987}: load: accepted connection
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60911}: load: accepted connection
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60911}:request{req.method=GET req.path="/m"}: load: received request. req.headers={"content-length": "7", "host": "[::1]:3000"} req.version=HTTP/1.1
DEBUG server{name=serve local=[::1]:3000}:conn{remote=[::1]:60912}: load: accepted connection
...
```

Notice how in addition to printing individual events, the span contexts in which
they occurred are also printed. In particular, each connection and request
creates its own span. However, these events are recorded very frequently, so the
logs are still scrolling by quite fast.

If we send a request to the demo app's admin endpoint, we can reload the filter
configuration to look only at the events recorded by the load generators:

```bash
:; curl -X PUT localhost:3001/filter -d "gen=debug"
```

These filters are specified using a syntax similar to that of the [`env_logger`]
crate.

The rate at which the logs scroll by slows down significantly, and we see output
like this:

```log
...
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: error received from server! status=404
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: error received from server! status=500
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: error received from server! status=500
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: error received from server! status=500
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: error received from server! status=500
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: error received from server! status=404
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: error received from server! status=500
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: error received from server! status=404
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: error received from server! status=404
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: error received from server! status=500
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: error received from server! status=404
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: error received from server! status=500
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: error received from server! status=404
...
```

Looking at the `request` spans output by the load generator, we start to notice
a pattern. The value of the `req.path` field is always either `"/"` or `"/z"`.

We can reload the filter configuration again, setting the verbosity to maximum
only when we're inside a span with the field `req.path` with the value `"/"`:

```bash
:; curl -X PUT localhost:3001/filter -d "[{req.path=\"/\"}]=trace"
```

The `[]` indicates that we wish to filter on `tracing` spans rather than on
static targets, and the `{}` indicate that we want to match span fields.

```log
...
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: sending request...
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: tower_buffer::service: sending request to buffer worker
DEBUG request{req.method=GET req.path="/"}: load: received request. req.headers={"content-length": "21", "host": "[::1]:3000"} req.version=HTTP/1.1
TRACE request{req.method=GET req.path="/"}: load: handling request...
TRACE request{req.method=GET req.path="/"}: load: rsp.error=path must be a single ASCII character
 WARN request{req.method=GET req.path="/"}: load: rsp.status=404
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: error received from server! status=404
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: response complete. rsp.body=path must be a single ASCII character
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: sending request...
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: tower_buffer::service: sending request to buffer worker
DEBUG request{req.method=GET req.path="/"}: load: received request. req.headers={"content-length": "18", "host": "[::1]:3000"} req.version=HTTP/1.1
TRACE request{req.method=GET req.path="/"}: load: handling request...
TRACE request{req.method=GET req.path="/"}: load: rsp.error=path must be a single ASCII character
 WARN request{req.method=GET req.path="/"}: load: rsp.status=404
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: error received from server! status=404
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: response complete. rsp.body=path must be a single ASCII character
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: gen: sending request...
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/"}: tower_buffer::service: sending request to buffer worker
DEBUG request{req.method=GET req.path="/"}: load: received request. req.headers={"content-length": "2", "host": "[::1]:3000"} req.version=HTTP/1.1
...
```

Now we see what's going on. The service doesn't support requests to `/` and is,
quite correctly, responding with a 404. But what about those 500 errors? We
remember that they seemed to only occur when the requested path is "/z"...

```bash
:; curl -X PUT localhost:3001/filter -d "[{req.path=\"/z\"}]=trace"
```

```log
...
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: sending request...
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: tower_buffer::service: sending request to buffer worker
DEBUG request{req.method=GET req.path="/z"}: load: received request. req.headers={"content-length": "0", "host": "[::1]:3000"} req.version=HTTP/1.1
TRACE request{req.method=GET req.path="/z"}: load: handling request...
TRACE request{req.method=GET req.path="/z"}: load: error=i don't like this letter. letter="z"
TRACE request{req.method=GET req.path="/z"}: load: rsp.error=unknown internal error
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: error received from server! status=500
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: response complete. rsp.body=unknown internal error
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: sending request...
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: tower_buffer::service: sending request to buffer worker
DEBUG request{req.method=GET req.path="/z"}: load: received request. req.headers={"content-length": "16", "host": "[::1]:3000"} req.version=HTTP/1.1
TRACE request{req.method=GET req.path="/z"}: load: handling request...
TRACE request{req.method=GET req.path="/z"}: load: error=i don't like this letter. letter="z"
TRACE request{req.method=GET req.path="/z"}: load: rsp.error=unknown internal error
ERROR load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: error received from server! status=500
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: response complete. rsp.body=unknown internal error
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: gen: sending request...
TRACE load_gen{remote.addr=[::1]:3000}:request{req.method=GET req.path="/z"}: tower_buffer::service: sending request to buffer worker
DEBUG request{req.method=GET req.path="/z"}: load: received request. req.headers={"content-length": "24", "host": "[::1]:3000"} req.version=HTTP/1.1
TRACE request{req.method=GET req.path="/z"}: load: handling request...
TRACE request{req.method=GET req.path="/z"}: load: error=i don't like this letter. letter="z"
TRACE request{req.method=GET req.path="/z"}: load: rsp.error=unknown internal error
...
```

We can now trace the entire life-cycle of a request to `/z`, ignoring everything
else that's happening concurrently. And, looking at the logged events, we see
that the service records that "I don't like this letter" and returns an internal
error. We've found the (admittedly, entirely fake) bug!

This kind of dynamic filtering is only possible with context-aware, structured
diagnostic instrumentation. Because nesting spans and events lets us construct
a tree of related contexts, we can interpret the diagnostics in terms of events
that are _logically_ or _causally_ linked (e.g., they occurred while handling
the same request) rather than those that are _temporally_ linked (they occurred
near each other in time).

If you're interested in seeing the code that produced these logs, or
interactively experimenting with this demo, you can check out the example
[here][example].

[`tower`]: https://crates.io/crates/tower
[`env_logger`]: https://crates.io/crates/env_logger
[reload]: https://docs.rs/tracing-subscriber/latest/tracing_subscriber/reload/index.html
[example]: https://github.com/tokio-rs/tracing/blob/master/examples/examples/tower-load.rs

## Getting Started with Tracing

`tracing` is available [on crates.io][tracing-crates]:

```toml
tracing = "0.1.5"
```

The easiest way to get started with `tracing` is to use the
[`tracing::instrument`][inst] attribute on a function. This attribute will
instrument the function to create and enter a new span when the function is
called, with the function's arguments recorded as fields on that span. For
example:

```rust
use tracing::instrument;

#[instrument]
pub async fn connect_to(remote: SocketAddr) -> io::Result<TcpStream> {
    // ...
}
```

`tracing` also provides a set of [function-like macros][macros] for constructing
spans and events. Users of the `log` crate should note that `tracing`'s
`trace!`, `debug!`, `info!`, `warn!` and `error!` macros are a superset of the
similarly-named macros in `log` and should be drop-in compatible:

```rust
use log::info;

info!("hello world!");
```

```rust
use tracing::info;

info!("hello world!");
```

The more idiomatic style, however, is to use these macros to record structured
data rather than unstructured messages. For example:

```rust
use tracing::trace;

let bytes_read = ...;
let num_processed = ...;

// ...

trace!(bytes_read, messages = num_processed);
```

A [`Subscriber`][subscriber] implementation collects and records trace data,
similarly to a logger in conventional logging. Applications must set up a
[default subscriber][default-sub].

The `Subscriber` interface is `tracing`'s main extension point; different
methods and policies for recording and processing trace data can be represented
as `Subscriber` implementations. Currently, the [`tracing-fmt`][fmt-crates]
crate provides a `Subscriber` implementation that logs trace data to the
console, and more implementations are soon to come.

More [API documentation][docs] is available on docs.rs, and examples are
provided in the [`tracing` github repository][github].

[inst]: https://docs.rs/tracing-attributes/latest/tracing_attributes/attr.instrument.html
[macros]: https://docs.rs/tracing/0.1.5/tracing/#macros
[subscriber]: https://docs.rs/tracing/0.1.5/tracing/trait.Subscriber.html
[default-sub]: https://docs.rs/tracing/0.1.5/tracing/dispatcher/index.html#setting-the-default-subscriber
[fmt-crates]: https://crates.io/crates/tracing-fmt/

## Building an Ecosystem

The `tracing` ecosystem is centered around the [`tracing`][tracing-crates]
crate, which provides the API used to instrument libraries and applications, and
the [`tracing-core`][core-crates], which provides the minimal, stable kernel of
functionality necessary to connect that instrumentation with `Subscriber`s.
However, this is just the tip of the iceberg. The [`tokio-rs/tracing`][github]
repository contains a number of additional crates, in varying degrees of
stability. These crates include:

- Compatibility layers with other libraries, such as [`tracing-tower`] and
  [`tracing-log`].
- `Subscriber` implementations, such as [`tracing-fmt`].
- The [`tracing-subscriber`] crate, which provides utilities for implementing
  and composing `Subscriber`s.

Stable releases of the central crates have been published to crates.io, and
`tracing` is already seeing adoption by projects like [Linkerd 2][linkerd] and
[Vector][vector]. However, there is a lot of future work, including:

- Integrating with distributed tracing systems such as [OpenTelemetry] or
  [Jaeger].
- Building out richer instrumentation in the Tokio runtime.
- Integration with more libraries and frameworks.
- Writing `Subscriber`s to implement more ways of collecting trace data, such as
  metrics, profiling, et cetera.
- Helping to stabilize experimental crates.

Contributions in all these areas will be welcomed eagerly. We're all looking
forward to seeing what the community will build on top of the platform that
`tracing` provides!

If you're interested, check out `tracing` [on GitHub][github] or join the
[Gitter] chat channel!

<div style="text-align:right">&mdash;Eliza Weisman</div>

[linkerd]: https://github.com/linkerd/linkerd2-proxy
[vector]: https://github.com/timberio/vector
[opentelemetry]: https://opentelemetry.io/
[jaeger]: https://www.jaegertracing.io/
[core-crates]: https://crates.io/crates/tracing-core
[tracing-crates]: https://crates.io/crates/tracing
[log-crates]: https://crates.io/crates/log
[`tracing-tower`]: https://github.com/tokio-rs/tracing/blob/master/tracing-tower
[`tracing-subscriber`]: https://crates.io/crates/tracing-subscriber
[`tracing-log`]: https://crates.io/crates/tracing-log
[`tracing-fmt`]: https://crates.io/crates/tracing-fmt
[docs]: https://docs.rs/tracing/0.1.5/tracing/
[github]: https://github.com/tokio-rs/tracing
[gitter]: https://gitter.im/tokio-rs/tracing
