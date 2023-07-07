---
date: "2022-02-18"
title: "Announcing Tokio Metrics 0.1"
description: "February 18, 2022"
---

Today, we are happy to announce the initial release of
[**tokio-metrics**][crates.io], a crate for getting a Tokio application's
runtime and task level metrics. Tokio Metrics makes it easier for Tokio users to
debug performance problems with their applications by providing visibility into
runtime behaviors in production.

[crates.io]: https://crates.io/crates/tokio-metrics

Today, Tokio is used successfully in large-scale production deployments at
companies like Amazon, Microsoft, Discord, and more. Yet, we commonly get
questions from engineers working on debugging issues. Maybe their response
times aren't quite what they would expect. Historically, there was no existing
tool that delivered the observability required to root cause these challenges
effectively. This challenge is why, last year, we [announced Tokio
Console][console-announcement], a tool for debugging Tokio applications. The
response from that announcement was amazing and we are already seeing it help
developers. However, Tokio Console is a local debugging tool and cannot (yet)
instrument applications in production.

[console-announcement]: ./2021-12-announcing-tokio-console

Tokio Metrics fills this gap. This crate provides insight into the Tokio
scheduler's behavior to help developer's identify where performance issues lay.
You can take these metrics and report them to your preferred tool (e.g.,
Grafana, Prometheus, CloudWatch, etc.) along with your application-level
metrics. Once you start collecting metrics, you will be able to [answer
questions] like:

- *Is the scheduler overloaded?*
- *Are my tasks running for too long without yielding?*
- *Are my tasks spending most of the time waiting on external events to
  complete?*

[answer questions]: https://docs.rs/tokio-metrics/0.1.0/tokio_metrics/struct.TaskMonitor.html#why-are-my-tasks-slow

Rafael Leite, an Amazon Web Services engineer working on S3, has been using
`tokio-metrics` for the past month. He says:

> These metrics were very helpful to understand internal behavior of the
> runtime, especially under load.

We are grateful for his early feedback, which helped us iterate on what
specific metrics we needed to get to discover root causes of performance
characteristics. I hope we will get more of such feedback from all of you as
you use this crate.

## Getting started

To use `tokio-metrics`, first add the crate to your Cargo.toml file:

```toml
[dependencies]
tokio-metrics = "0.1.0"
```

Because `tokio-metrics` uses some unstable Tokio APIs, you must also enable the
`tokio_unstable` flag. You can do this by adding the following to a
`.cargo/config` file in your crate root:

```toml
[build]
rustflags = ["--cfg", "tokio_unstable"]
rustdocflags = ["--cfg", "tokio_unstable"]
```

Next, construct a [`TaskMonitor`] for each key task; e.g., for each endpoint of
a web service and their key sub-tasks:

[`TaskMonitor`]: https://docs.rs/tokio-metrics/0.1.0/tokio_metrics/struct.TaskMonitor.html

```rust
// monitor for the `/` endpoint
let monitor_root = tokio_metrics::TaskMonitor::new();

// monitors for the POST /users endpoint
let monitor_create_user = CreateUserMonitors {
    // monitor for the entire endpoint
    route: tokio_metrics::TaskMonitor::new(),
    // monitor for database insertion subtask
    insert: tokio_metrics::TaskMonitor::new(),
};
```

Then, use these monitors to instrument key tasks:

```rust
let app = axum::Router::new()
    // `GET /` goes to `root`
    .route(
        "/",
        axum::routing::get({
            // monitor the tasks that respond to `GET /`
            let monitor = monitor_root.clone();
            move || monitor.instrument(async { "Hello, World!" })
        }),
    )
    // `POST /users` goes to `create_user`
    .route(
        "/users",
        axum::routing::post({
            // monitor the tasks that respond to `POST /users`
            let monitors = monitor_create_user.clone();
            let route = monitors.route.clone();
            move |body| route.instrument(create_user(body, monitors))
        }),
    );
```

Finally, access the metrics:

```rust
// print task metrics for each endpoint every 1s
let metrics_frequency = std::time::Duration::from_secs(1);
tokio::spawn(async move {
   // call `.intervals()` on each monitor to get an endless
   // iterator of metrics sampled from that monitor
   let root_intervals = monitor_root.intervals();
   let create_user_route_intervals =
      monitor_create_user.route.intervals();
   let create_user_insert_intervals =
      monitor_create_user.insert.intervals();

   // zip the metrics streams together
   let create_user_intervals =
      create_user_route_intervals
         .zip(create_user_insert_intervals);
   let intervals = root_intervals.zip(create_user_intervals);

   // print the metrics for each monitor to stdout
   for (root_rt, (create_user_rt, create_user_insert)) in intervals {
      println!("root_route = {:#?}", root_rt);
      println!("create_user_route = {:#?}", create_user_rt);
      println!("create_user_insert = {:#?}", create_user_insert);
      tokio::time::sleep(metrics_frequency).await;
   }
});
```
You can find some more examples [here][examples], and the
[documentation][docs.rs] goes into more detail.

[examples]: https://github.com/tokio-rs/tokio-metrics/tree/main/examples
[docs.rs]: https://docs.rs/tokio-metrics

This launch is an early access release. Work on `tokio-metrics` has just
started. As you start getting more visibility into the Tokio runtime, we expect
you will have more questions and get more ideas for how to debug your
applications. We want to hear these as it will inform us as we continue to work
on both Tokio Metrics and Tokio Console. So, give it a shot, and let us know
how it goes. Please [file issues][issue-tracker] and [ping us on
Discord][discord].

[issue-tracker]: https://github.com/tokio-rs/tokio-metrics/issues
[discord]: https://discord.gg/tokio

<div style="text-align:right">
   &mdash; Carl Lerche (<a href="https://github.com/carllerche">@carllerche</a>)
   &amp; Jack Wrenn (<a href="https://github.com/jswrenn">@jswrenn</a>)
</div>
