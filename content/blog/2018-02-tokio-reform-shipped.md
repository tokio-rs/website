+++
date = "2018-02-07"
title = "Tokio Reform is Shipped and the Road to 0.2"
description = "19 September 2017"
menu = "blog"
weight = 102
+++

Hi all!

I'm happy to announce that today, the changes proposed in the [reform RFC] have
been released to [crates.io] as `tokio` 0.1.

The primary changes are:

* Add a *default* global event loop, eliminating the need for setting up and
  managing your own event loop in the vast majority of cases.

* Decouple all task execution functionality from Tokio.

## The new global event loop

Up until today, creating an event loop was a manual process. Even though the
vast majority of Tokio users would setup the reactor to do the same thing,
everyone had to do it each time. This was partially due to the fact that there
was a significant difference between running code on the Tokio reactor's thread
or from another thread (like a thread pool).

The key insight that allowed for the Tokio reform changes is that the Tokio
reactor doesn't actually have to be an executor. In other words, prior to these
changes, the Tokio reactor would both power I/O resources **and** manage
executing user submitted tasks.

Now, Tokio provides a reactor to drive I/O resources (like `TcpStream` and
`UdpSocket`) separately from the task executor. This means that it is easy to
create Tokio-backed networking types from *any* thread, making it easy to create
either single or multi threaded Tokio-backed apps.

For task execution, Tokio provides the [`current_thread`] executor, which
behaves similarly to how the built-in tokio-core executor did. The plan is to
eventually move this executor into the [`futures`] crate, but for now it is
provided directly by Tokio.

## The road to 0.2

The Tokio reform changes have been released as 0.1. Dependencies ([`tokio-io`],
[`futures`], [`mio`], etc...) have not had their versions incremented. This
allows the `tokio` crate to be released with minimal ecosystem disruption.

The plan is to let the changes made in this release get some usage before
committing to them. Any fixes that require breaking changes will be able to be
done at the same time as the release to all the other crates. The goal is for
this to happen in 6-8 weeks. So please try out the changes released today and
provide feedback.

## Rapid iteration

This is just the beginning. Tokio has ambitious goals to provide additional
functionality to get a great "out of the box" experience building asynchronous
I/O applications in Rust.

In order to reach these goals as fast as possible without causing unnecessary
ecosystem disruption, we will be taking a few steps.

First, similarly to the [`futures` 0.2 release], the `tokio` crate will be
transitioned to be more of a facade. Traits and types will be broken up into a
number of sub crates and re-exported by `tokio`. Application authors will be
able to depend directly on `tokio` while library authors will pick and choose
the specific Tokio components that they wish to use as part of their libraries.

Each sub crate will clearly indicate its stability level. Obviously, there is an
upcoming breaking change with the futures 0.2 release, but after that,
fundamental building blocks will aim to remain stable for at least a year. More
experimental crates will reserve the right to issue breaking changes at a
quicker pace.

This means that the `tokio` crate itself will be able to iterate at a faster
pace while the library ecosystem remains stable.

The pre 0.2 period will also be a period of experimentation. Additional
functionality will be added to Tokio in an experimental capacity. Before an 0.2
release, an RFC will be posted covering the functionality that we would like to
include in that release.

## Open question

One remaining question is what to do about `tokio-proto`. It was released as
part of the initial Tokio release. Since then, the focus has shifted and that
crate has not received enough attention.

I posted an issue to discuss what to do with that crate
[here](https://github.com/tokio-rs/tokio/issues/118)

## Looking Forward

Please try out the changes released today. Again, the next couple of months are a period
of experimentation before we commit on the next release. So, now is the time to try things
out and provide feedback.

During this time, we'll be integrating this work to build out higher-level
primitives in [Tower], which is being driven by the production operational needs
of the [Conduit] project.

<div style="text-align:right">&mdash;Carl Lerche</div>

[reform RFC]: https://github.com/tokio-rs/tokio-rfcs/blob/master/text/0001-tokio-reform.md
[crates.io]: https://crates.io/crates/tokio
[`current_thread`]: {{< api-url "tokio" >}}/executor/current_thread/index.html
[`tokio-io`]: https://github.com/tokio-rs/tokio-io
[`futures`]: https://github.com/rust-lang-nursery/futures-rs
[`mio`]: https://github.com/carllerche/mio
[`futures` 0.2 release]: #
[Tower]: https://github.com/tower-rs/tower
[Conduit]: https://github.com/runconduit/conduit
