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

Then, to include your `async fn`s in async task traces, simply annotate them
with `#[async_backtrace::framed]` and call [`taskdump_tree`] to receive
pretty-printed trees of your application's tasks. For instance:

[`taskdump_tree`]: https://docs.rs/async-backtrace/0.2.0/async_backtrace/fn.taskdump_tree.html

```rust
#[tokio::main(flavor = "current_thread")]
async fn main() {
    tokio::select! {
        // run the following branches in order of their appearance
        biased;

        // spawn task #1
        _ = tokio::spawn(foo()) => { unreachable!() }

        // spawn task #2
        _ = tokio::spawn(foo()) => { unreachable!() }

        // print the running tasks
        _ = tokio::spawn(async {}) => {
            println!("{}", async_backtrace::taskdump_tree(true));
        }
    };
}

#[async_backtrace::framed]
async fn foo() {
    bar().await;
}

#[async_backtrace::framed]
async fn bar() {
    baz().await;
}

#[async_backtrace::framed]
async fn baz() {
    std::future::pending::<()>().await
}
```

Running the above example prints the trees:

```text
╼ multiple::foo::{{closure}} at backtrace/examples/multiple.rs:22:1
  └╼ multiple::bar::{{closure}} at backtrace/examples/multiple.rs:27:1
     └╼ multiple::baz::{{closure}} at backtrace/examples/multiple.rs:32:1
╼ multiple::foo::{{closure}} at backtrace/examples/multiple.rs:22:1
  └╼ multiple::bar::{{closure}} at backtrace/examples/multiple.rs:27:1
     └╼ multiple::baz::{{closure}} at backtrace/examples/multiple.rs:32:1
```

See [here][examples] for more examples!

[examples]: https://github.com/tokio-rs/async-backtrace/blob/main/backtrace/examples

## Feedback Welcome

This launch is only an initial release. Work on `async-backtrace` has just
begun. To guide our development, we need your feedback. So, give it a shot, and
let us know how it goes. Please [file issues][issue-tracker] and
[ping us on Discord][discord].

[issue-tracker]: https://github.com/tokio-rs/async-backtrace/issues
[discord]: https://discord.gg/tokio

<div style="text-align:right">
   &mdash; Jack Wrenn (<a href="https://github.com/jswrenn">@jswrenn</a>)
</div>
