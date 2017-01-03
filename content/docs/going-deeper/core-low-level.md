+++
title = "Low-level I/O using core"
description = ""
menu = "going_deeper"
weight = 104
+++

TODO: talk about working with `Read` and `Write` etc

> Some text from Alex's draft

Additionally the I/O objects are also "futures-aware" in how they interact with
a future's task. Whenever a "would block" error is returned, then like with
futures returning `Async::NotReady`, the current task is scheduled to get woken
up when the I/O object is otherwise ready. This means that you can typically do
I/O as usual in a future, return `NotReady` when you see "would block", and
you'll get automatically retried when data is otherwise available. Note that
this importantly means that I/O cannot be performed off the task of a future,
similarly to how `Future::poll` cannot be called off the task of a future.
