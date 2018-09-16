---
title: "Introduction"
weight: 8001
menu:
  docs:
    parent: "internals"
---

The internals section provides an in-depth guide of Tokio's internals. It
expects the reader already has a good understanding of how to use Tokio. Those
unfamiliar with Tokio should start with the [getting started][guide] guide.

[guide]: {{< ref "/docs/getting-started/hello-world.md" >}}

* [Runtime model]({{< relref "runtime-model.md" >}}) - An overview of Tokio's
  asynchronous runtime model.
* [Non-blocking I/O]({{<relref "net.md" >}}) - Implementation details of Tokio's
  network related types (TCP, UDP, ...).
