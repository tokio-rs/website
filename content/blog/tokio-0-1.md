+++
title = "Announcing Tokio 0.1"
description = "10 January 2017"
menu = "blog"
weight = 100
+++

Today we are publishing the preliminary version of the Tokio stack, 0.1!

**Tokio is a platform for writing fast networking code in Rust.** It's built on
futures,
[a zero-cost abstraction for asynchronous programming in Rust](http://aturon.github.io/blog/2016/08/11/futures/).
It provides a suite of basic tools, `tokio-core`, for asynchronous I/O with
futures.  It also provides a higher-level layer, `tokio-proto`, for easily
building sophisticated servers and clients; all you have to do is handle message
serialization. You can use the Tokio stack to handle a wide range of protocols,
including streaming and multiplexed protocols, as well as more specialized
servers like proxies.

**Tokio is primarily intended as a foundation for other libraries**, in
particular for high performance protocol implementations. Over time, we expect
Tokio to grow a rich middleware ecosystem and ultimately to support various web
and application frameworks. [Hyper], for example, has been adding Tokio
integration, and there's a [growing list] of other protocol implementations as
well.

[Hyper]: http://hyper.rs/
[growing list]: {{< relref "third-party.md" >}}

Along with this initial release, **we're publishing
[documentation]({{< relref "tokio.md" >}})** on this web site, ranging from
getting started guides to meatier examples to deep dives into the implementation
of the stack. Please take a look, and
[let us know](https://github.com/tokio-rs/website/issues) what needs to be
improved!

The 0.1 release is a **beta quality** release. The stack has undergone a fair
amount of testing, usage, and feedback, but it's still early days, and we don't
have a lot of production use under our belt yet. Intrepid users are welcomed to
work toward production usage, but you should expect bugs and limitations. The
[gitter channel] is active and helpful for both learning and debugging.

[gitter channel]: https://gitter.im/tokio-rs/tokio

This release also represents a point of **relative stability** for the library,
which has been undergoing frequent breaking changes up until now. While we do
intend to eventually publish a 0.2 release with breaking changes, we will take
steps to make migration easy and plan to maintain the 0.1 release in parallel
for some time. Potential areas of breakage are flagged under the 0.2 milestone
in our repositories; please take a look and leave your thoughts on those issues!

Looking ahead, there are several major areas we're hoping to pursue after this
release:

- Starting to build out a middleware ecosystem, built on top of [tokio-service].
- Resolving remaining questions about backpressure.
- Providing richer customization for server and client builders, and in general
  providing more tools for clients.
- Completing a full HTTP/2 implementation.

And in general, we are eager to support the growing Tokio ecosystem. Come kick
the tires, try to build something, and let us know what can be improved!

<div style="text-align:right">&mdash;Carl Lerche, Alex Crichton, and Aaron Turon</div>

[tokio-service]: https://github.com/tokio-rs/tokio-service
