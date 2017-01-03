+++
title = "What is Tokio?"
menu = "getting_started"
weight = 0
+++

##### Tokio is a platform for writing fast networking code in Rust.

It's broken into
several layers, with entry points based on your needs:

* **The `tokio-proto` layer is the easiest way to build servers and
  clients**. All you have to do is handle message serialization; proto takes
  care of the rest.  The library encompasses a wide range of protocol flavors,
  including streaming and multiplexed protocols.

* **The `tokio-core` layer is good for writing specialized, low-level
  asynchronous code**. It allows you to work directly with I/O objects and event
  loops, but provides high-level, ergonomic APIs for doing so. Use `tokio-core`
  if your problem doesn't fit into `tokio-proto`, or you need absolute control
  over the internals of your server or client.

* **The `futures-rs` layer provides abstractions like futures, streams and
  sinks**, which are used throughout Tokio and the wider ecosystem. These
  zero-cost abstractions are our approach for productive, asynchronous
  programming in Rust.

Usually `tokio-proto` is the right place to start, and that's how we'll start
with the guide as well.
