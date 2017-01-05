+++
title = "Larger examples"
description = ""
menu = "going_deeper"
weight = 108
+++

Often times when learning a new framework or if you're just getting your feet
wet with async I/O it's very helpful to look at a lot of examples. Tokio
certainly has no shortage of such ranging from small to large! Here we'll
categorize some programs that are well commented and suitable to learn from. If
you've got your own example you'd like to see here feel free to send a PR to
update this list!

* [A SOCKSv5 proxy server][tokio-socks5] implemented at the [`tokio-core`]
  layer. This server shows off a mixture of high and low level I/O using TCP
  streams as well as shows off the asynchronous DNS library, [trust-dns]. An
  interesting optimization for this server is that there's only one globally
  allocated buffer through which all proxied data travels through, making it
  quite efficient at buffer management.

* [A line-based protocol for tokio-proto][tokio-line] showcasing both pipelined
  and multiplexed versions also with built-in servers/clients to see how they
  interoperate together.

* [Examples in `tokio-core` itself][tokio-core-examples] should be well
  documented and self contained to play around with the abstractions in
  [`tokio-core`]. These examples range from a [chat server] to a small
  [`nc`-like program].

[`tokio-core`]: https://github.com/tokio-rs/tokio-core
[tokio-socks5]: https://github.com/tokio-rs/tokio-socks5/blob/master/src/main.rs
[trust-dns]: http://trust-dns.org/
[tokio-line]: https://github.com/tokio-rs/tokio-line
[tokio-core-examples]: https://github.com/tokio-rs/tokio-core/tree/master/examples
[chat server]: https://github.com/tokio-rs/tokio-core/blob/master/examples/chat.rs
[`nc`-like program]: https://github.com/tokio-rs/tokio-core/blob/master/examples/connect.rs

If you're feeling a intrepid you can also explore the source code of [third
party projects]({{< relref "third-party.md" >}}) using Tokio, or [Tokio
itself][tokio]! This is often a great way to see abstractions in action and poke
around in general.

[tokio]: https://github.com/tokio-rs
