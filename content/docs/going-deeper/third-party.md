+++
title = "Third-party crates"
description = ""
menu = "going_deeper"
weight = 110
+++

Currently the [`futures`], [`tokio-core`], [`tokio-service`], and [`tokio-proto`] crates provide
the foundation for the Tokio ecosystem. There's a growing set of crates outside
of Tokio itself, however, filling in more functionality!

* [`tokio-curl`] is an HTTP client library backed by the libcurl C library.
* [`tokio-timer`] is a timer library providing finer-grained control over timers
  and helpful timeout facilities over the types in [`tokio-core`].
* [`tokio-tls`] is a library for TLS streams backed by [`native-tls`].
* [`tokio-openssl`] is similar to [`tokio-tls`] but hardwired to OpenSSL.
* [`tokio-uds`] is a Unix library for supporting Unix Domain Sockets in the same
  way that `tokio_core::net` works with TCP sockets
* [`tokio-inotify`] enables the use of inotify file descriptors as a `Stream`.
* [`tokio-signal`] allows abstraction Unix signals as a `Stream`.
* [`tokio-process`] enables asynchronous process managment, both for child
  processes exiting as well as I/O pipes to children.
* [`trust-dns`] is an asynchronous DNS client and server, supporting features
  like DNSSec as well
* [`capnproto-rust`] is an implementation of Cap'n Proto for Rust which has the
  ability to with futures as well
* [`tk-sendfile`] allows using the `sendfile` syscall with Tokio
* [`tokio-postgres`] is an asynchronous PostgreSQL driver

If you've got your own crate or know of others that should be present on this
list, please feel free to send a PR!

[`futures`]: https://github.com/alexcrichton/futures-rs
[`tokio-core`]: https://github.com/tokio-rs/tokio-core
[`tokio-service`]: https://github.com/tokio-rs/tokio-service
[`tokio-proto`]: https://github.com/tokio-rs/tokio-proto
[`tokio-curl`]: https://github.com/tokio-rs/tokio-curl
[`tokio-timer`]: https://github.com/tokio-rs/tokio-timer
[`tokio-tls`]: https://github.com/tokio-rs/tokio-tls
[`tokio-openssl`]: https://github.com/alexcrichton/tokio-openssl
[`native-tls`]: https://github.com/sfackler/rust-native-tls
[`tokio-uds`]: https://github.com/tokio-rs/tokio-uds
[`tokio-dns`]: https://github.com/sbstp/tokio-dns
[`tokio-inotify`]: https://github.com/dermesser/tokio-inotify
[`tokio-signal`]: https://github.com/alexcrichton/tokio-signal
[`tokio-process`]: https://github.com/alexcrichton/tokio-process
[`trust-dns`]: http://trust-dns.org/
[`capnproto-rust`]: https://github.com/dwrensha/capnproto-rust
[`tk-sendfile`]: https://crates.io/crates/tk-sendfile
[`tokio-postgres`]: https://crates.io/crates/tokio-postgres
[`thrussh`]: https://crates.io/crates/thrussh
