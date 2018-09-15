---
title: "Introduction"
menu:
  docs:
    parent: "internals"
    weight: 8001
---

This document provides an in depth guide of the internals of Tokio, the various
components, and how they fit together. It expects that the reader already has a
fairly good understanding of how to use Tokio. A [getting started][guide] guide
is provided on the website.

[guide]: {{< ref "/docs/getting-started/hello-world.md" >}}

# Contents

* [Runtime model]({{< relref "runtime-model.md" >}}) - An overview of Tokio's
  asynchronous runtime model.
* [Non-blocking I/O]({{<relref "net.md" >}}) - Implementation details of Tokio's
  network related types (TCP, UDP, ...).
