+++
title = "Tasks and executors"
description = ""
menu = "going_deeper"
weight = 108
+++

The concepts of a tasks for futures were introduced in [the futures model in
depth]({{< relref "futures-model.md" >}}), but here we're going to dig into
their mechanics much more deeply along with examples of how to implement various
execution models.

## [Exploring `Future::wait`](#exploring-wait) {#exploring-wait}

* explain how `wait` works
* explain `spawn`
* explain how tokio-core works
  * namely synchronization around unpark
* explain how futures-cpupool works
  * queue of runnable items
* unpark events
* be sure to mention that tasks use thread local storage
