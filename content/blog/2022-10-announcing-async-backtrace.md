---
date: "2022-10-27"
title: "Announcing async-backtrace"
description: "October 27, 2022"
---

Today, we are happy to announce the initial release of
[**async-backtrace**][crates.io], a crate that enables you to efficiently track
and view the state of asynchronous tasks in your application.

[crates.io]: https://crates.io/crates/async-backtrace

In synchronous, multi-threaded applications, you can investigate deadlocks by
inspecting stack traces of all running threads. Unfortunately, this approach
breaks down for most asynchronous Rust applications, since suspended tasks —
tasks that are not actively being polled — are invisible to traditional stack
traces. The `async-backtrace` crate fills this gap, allowing you see the state
of these hidden tasks. It is architected to be highly efficient without
configuration, and is suitable for deployment in production environments.

This crate complements (but is not yet integrated with) the [`tracing`] library
and [`tokio-console`]. Use `async-backtrace` for a birds-eye view of task state
in your application, and [`tracing`] for isolating the inputs that lead to that
state. If your application uses the tokio runtime, you can use [`tokio-console`]
for a deeper look into your application's interactions with tokio's
synchronization primitives.

[`tracing`]: https://github.com/tokio-rs/tracing
[`tokio-console`]: https://github.com/tokio-rs/console

## Getting Started

To use `async-backtrace`, first add the crate to your `Cargo.toml` file:

```toml
[dependencies]
async-backtrace = "0.2"
```

Then, to include your `async fn`s in async task traces, simply annotate
them with `#[async_backtrace::framed]`; e.g.:

```rust
#[async_backtrace::framed]
async fn fiz() {
    tokio::task::yield_now().await;
}
```

Finally, to view a pretty-printed tree of your application's tasks, call
[`taskdump_tree`], which produces outputs like:

```text
╼ taskdump::foo::{{closure}} at backtrace/examples/taskdump.rs:20:1
  └╼ taskdump::bar::{{closure}} at backtrace/examples/taskdump.rs:25:1
     ├╼ taskdump::buz::{{closure}} at backtrace/examples/taskdump.rs:35:1
     │ └╼ taskdump::baz::{{closure}} at backtrace/examples/taskdump.rs:40:1
     └╼ taskdump::fiz::{{closure}} at backtrace/examples/taskdump.rs:30:1
╼ taskdump::pending::{{closure}} at backtrace/examples/taskdump.rs:15:1
```

[`taskdump_tree`]: https://docs.rs/async-backtrace/0.2.0/async_backtrace/fn.taskdump_tree.html

These traces become trees — instead of stacks — in the presence of operations
like `select!` and `join!`. For a full example of this, see
[`examples/taskdump.rs`]. Only `async fn`s annotated with
`#[async_backtrace::framed]` are included in traces. The
`#[async_backtrace::framed]` attribute can be applied liberally without
significantly impacting performance.

[`examples/taskdump.rs`]: https://github.com/tokio-rs/async-backtrace/blob/main/backtrace/examples/taskdump.rs

## Feedback Welcome

This launch is only an initial release. Work on `async-backtrace` has just
begun. To guide our development, we need your feedback. So, give it a shot, and
let us know how it goes. Please [file issues][issue-tracker] and
[ping us on Discord][discord].

[issue-tracker]: https://github.com/tokio-rs/tokio-metrics/issues
[discord]: https://discord.gg/tokio

<div style="text-align:right">
   &mdash; Jack Wrenn (<a href="https://github.com/jswrenn">@jswrenn</a>)
</div>
