---
date: "2021-12-17"
title: "Announcing Tokio Console 0.1"
description: "December 17, 2021"
---


Today, we, the Tokio team, are announcing the initial release of Tokio Console
([Github](https://github.com/tokio-rs/console)), enabling Rust developers to gain deeper
insight into the runtime behavior of their applications.

> And just like that, we get to peek under the hood.
> [&mdash;niedzejkob](https://niedzejkob.p4.team/amos-nerdsniped-me/)

Tokio Console is a diagnostics and debugging tool for asynchronous Rust
programs. It gives you a live, easy-to-navigate view into the program's tasks
and resources, summarizing both their current status and their historical
behavior.

Until now, understanding the state of an async runtime has required developers
to interpret event logs. Frameworks like [`tracing`] provide tools for
instrumenting programs and querying the resulting output, but it is non-trivial
to know what queries to use, and how to interpret the output. For example, if
you are not familiar with the source code of Tokio, you won't necessarily know
which `tracing` events to look for, nor what those events mean.

`tokio-console` solves this problem by providing a presentation of the async
runtime that is described in terms already familiar to the async developer: the
set of tasks being polled by the async runtime, and the resources that each task
acquires or releases as it services requests. You do not need to write any new
instrumentation logic: just one line of code to enable Tokio Console suffices,
and after that, you use the provided terminal tool to observe the async runtime.

`tokio-console` brings odd behaviors to the forefront. You can sort the tasks by
metrics such as total busy time or number of polls. The console helps out by
highlighting big differences, such as shifts from milliseconds to seconds.

![tasks list screenshot](https://raw.githubusercontent.com/tokio-rs/console/main/assets/tasks_list.png)

In addition to displaying data, the console implements a "warnings" system. You
can think of this as like [clippy] for async code. By monitoring the runtime
operation of tasks in the application, the console can detect patterns of
behavior that *might* suggest a bug or performance issue, and highlight them for
the user to analyse. This allows us to detect things like [tasks that have run
for a very long time without yielding][blocking], tasks that have woken
themselves more times than they've been woken by other tasks, and more. All of
these behaviors are impossible to detect at compile-time &mdash; there's no way
for clippy or `rustc` to add lints for them &mdash; but by watching runtime
behavior, we can detect them very easily.

![warnings screenshot](https://raw.githubusercontent.com/tokio-rs/console/main/assets/warnings.png)

Adding the [`console-subscriber`] crate exposes the instrumentation already
built into the Tokio runtime, so you do not need to write any new
instrumentation logic. (Of course, you can tailor the console output &mdash; for
example, by explicitly naming your tasks &mdash; if desired.) After
initialization, you can use the `tokio-console` terminal application to directly
see what tasks are running and how they are being scheduled by the async
runtime.

We can use this data to view extremely rich data about each individual task,
such as a histogram of `poll` durations:

![task details](https://raw.githubusercontent.com/tokio-rs/console/main/assets/details2_crop.png)

Tokio Console goes beyond just listing tasks. It will also instrument resources,
such as async [mutexes] and [semaphores]. Tokio Console's resource details view
shows you which tasks have entered a critical section, and which tasks are
waiting to obtain access.

![resource details](https://raw.githubusercontent.com/tokio-rs/console/main/assets/resource_details2.png)


The devs at [Datadog](https://www.datadoghq.com/), working on
[Vector](https://vector.dev/), have already successfully been using pre-release
versions of Tokio Console to help debug issues. [Toby Lawrence](https://github.com/tobz)
says:

> While debugging a particularly mysterious issue related to a task not making
> progress as expected, `tokio-console` was able to immediately surface that a
> lack of wake-ups was the cause, providing insight that ultimately lead to
> discovering unexpected scheduling behavior with Tokio.

# Getting Started

To get started with the console, run `cargo install tokio-console`, then follow
the instructions to [add `console-subscriber`][subscriber doc] to your async
application:

```rust
#[tokio::main]
async fn main() {
   console_subscriber::init();
   /* ... */
}
```

Once your application is running, you can connect to it by running
`tokio-console` in a terminal.

```
% tokio-console
```

See the [`tokio-console` documentation][console doc] for details on how to use
the console terminal application.

Because this is an early release, the instrumentation of the Tokio runtime has
not yet been stabilized. You can enable it by compiling Tokio with the unstable
environment variable set: `RUSTFLAGS="--cfg tokio_unstable" cargo build`. See
the [subscriber documentation][subscriber doc] for more details.

[`tracing`]: https://crates.io/crates/tracing
[subscriber doc]: https://docs.rs/console-subscriber/latest/console_subscriber/
[console doc]: https://docs.rs/tokio-console/latest/tokio_console/#getting-started
[`console-subscriber`]: https://crates.io/crates/console-subscriber
[clippy]: https://github.com/rust-lang/rust-clippy
[blocking]: https://ryhl.io/blog/async-what-is-blocking/
[mutexes]: https://docs.rs/tokio/latest/tokio/sync/struct.Mutex.html
[semaphores]: https://docs.rs/tokio/latest/tokio/sync/struct.Semaphore.html

# Roadmap

This release of Tokio Console is just the beginning. While we think it already
is very useful to help debug async Rust applications, we have much more planned
(e.g. [#96], [#130], [#155], and [#161]). First, we will be adding more
instrumentation, both in Tokio and other ecosystem libraries. This will help you
get even more insight into your applications. We also want to improve the
warning system: adding more warnings, and adding searchable, online
documentation describing various warnings and how they can be solved ([#181],
[#148]). Furthermore, there is a lot more we can do with the data the console
collects now: we would love to add new visualizations, like a tree of tasks and
their parents ([#155]) or a timeline of the program's execution ([#129]).

To do all this, however, we need you to start using Tokio Console and provide
feedback. In particular, we want to gather as much information as possible about
the problems people are using the console to debug, and what tools we can
provide to help. We would also love to get you involved in helping us build the
future of runtime diagnostics for Rust, so be sure to say hi in the `#console`
channel on [Discord](https://discord.gg/tokio) and always feel free to jump in
on [issues](https://github.com/tokio-rs/console) and send pull requests our way!

[#96]: https://github.com/tokio-rs/console/issues/96
[#130]: https://github.com/tokio-rs/console/issues/130
[#155]: https://github.com/tokio-rs/console/issues/155
[#161]: https://github.com/tokio-rs/console/issues/161
[#181]: https://github.com/tokio-rs/console/issues/181
[#148]: https://github.com/tokio-rs/console/issues/148
[#155]: https://github.com/tokio-rs/console/issues/155
[#129]: https://github.com/tokio-rs/console/issues/129


# Thanks to

* Sean McArthur
* Zahari Dichev
* @gnieto
* Felix S Klock II
* Gus Wynn
* Oğuz Bilgener 
* @memoryruins
* Luna Razzaghipour 
* @daladim
* @hatoo
* Adam Gleave
* Jacob Rothstein 
* David Barsky
* @Milo123459
* Wu Aoxiang 
* Yusuf Bera Ertan
* @battlmonstr
* Artem Vorotnikov

Also, a very special thank-you to Matthias Prechtl ([@matprec]), whose [2019
Google Summer of Code project][gsoc] to implement an initial console prototype paved
the way for the current Tokio Console release!

`tokio-console` is built upon a foundation laid by the [Tracing] and [Tonic]
libraries.

[Tracing]: https://tokio.rs/blog/2019-08-tracing
[Tonic]: https://tokio.rs/blog/2021-07-tonic-0-5
[@matprec]: https://github.com/matprec
[gsoc]: https://github.com/tokio-rs/console-gsoc

We are indebted to everyone who has contributed to this project, and to all our
early users who have been trying it out in your applications and giving us
invaluable feedback!

If you want to help us make `tokio-console` even better, take a look at our
[github repository](https://github.com/tokio-rs/console), or come talk to us at
the `#console` channel on Tokio's [Discord](https://discord.gg/4A5K8WD4)!

<div style={{ textAlign: "right" }}>&mdash; Eliza Weisman (<a href="https://github.com/hawkw">@hawkw</a>)</div>
