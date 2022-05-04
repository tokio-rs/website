---
title: Getting started with Tracing
---

The [`tracing`] crate is a framework for instrumenting Rust programs to collect 
structured, event-based diagnostic information.

In asynchronous systems like Tokio, interpreting traditional log messages can 
often be quite challenging. Since individual tasks are multiplexed on the same 
thread, associated events and log lines are intermixed making it difficult to 
trace the logic flow. `tracing` expands upon logging-style diagnostics by 
allowing libraries and applications to record structured events with additional 
information about *temporality* and *causality* — unlike a log message, a span 
in `tracing` has a beginning and end time, may be entered and exited by the 
flow of execution, and may exist within a nested tree of similar spans. In 
addition, `tracing` spans are *structured*, with the ability to record typed 
data as well as textual messages.

You can use `tracing` to:
- observe your application with Open Telemetry-supporting services
- debug your application with Tokio Console
- emit logs to `stdout` or `journald`
- profile where your application is spending time

[`tracing`]: https://docs.rs/tracing
[`tracing-subscriber`]: https://docs.rs/tracing-subscriber

# Setup

To begin, add [`tracing`] and [`tracing-subscriber`] as dependencies:

```toml
[dependencies]
tracing = "0.1.34"
tracing-subscriber = "0.3"
```

The [`tracing`] crate provides the API we will use to emit traces. The 
[`tracing-subscriber`] crate provides some basic utilities for forwarding those 
traces to external listeners (e.g., `stdout`).

# Subscribing to Traces

If you are authoring an executable (as opposed to a library), you will need to 
register a tracing *subscriber*. Subscribers are types that process traces 
emitted by your application and its dependencies, and and can perform tasks 
such as computing metrics, monitoring for errors, and re-emitting traces to the 
outside world (e.g., `journald`, `stdout`, or an `open-telemetry` daemon).

In most circumstances, you should register your tracing subscriber as early as
possible in your `main` function. For instance, the [`FmtSubscriber`] type
provided by [`tracing-subscriber`] prints formatted traces and events to
`stdout`, can be registered like so:

```rust
#[tokio::main]
pub async fn main() -> mini_redis::Result<()> {
    // construct a subscriber that prints formatted traces to stdout
    let subscriber = tracing_subscriber::FmtSubscriber::new();
    // use that subscriber to process traces emitted after this point
    tracing::subscriber::set_global_default(subscriber)?;

    ...
}
```

[`FmtSubscriber`]: https://docs.rs/tracing-subscriber/latest/tracing_subscriber/fmt/index.html

If you run your application now, you may see some trace events emitted by tokio,
but you will need to modify your own application to emit traces to get the most
out of `tracing`.

# Emitting Traces

The easiest way to emit traces is with the [`instrument`] proc-macro annotation
provided by [`tracing`], which re-writes the bodies of functions to emit traces
each time they are invoked.

[`instrument`]: https://docs.rs/tracing/latest/tracing/attr.instrument.html

For instance, to trace the method in `mini-redis-server` that handles each
connection:

```rust
impl Handler {
    /// Process a single connection.
    #[instrument(
        level = "info",
        name = "Handler::run",
        skip(self),
        fields(
            ?peer_addr = self.connection.peer_addr().unwrap(),
        ),
    )]
    async fn run(&mut self) -> crate::Result<()> {
        ...
    }
}
```

Now, `mini-redis-server` will emit a tracing span for each incoming connection
that:

1. has a priority [level] of `info` (the second-highest priority)
2. is named `Handler::run`
3. has some structured data associated with it:   
    - `skip(self)` indicates that emitted traces should *not*
    include the `Debug` representation of `Handler`
    - `fields(...)` indicates that emitted traces *should* include
    the `Debug` representation of the connection's `SocketAddr`, in a field
    called `peer_addr`

[level]: https://docs.rs/tracing/latest/tracing/struct.Level.html

If you run your application, you now will see trace events emitted for each
incoming connection that it processes.
