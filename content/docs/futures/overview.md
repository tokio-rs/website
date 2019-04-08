---
title: "Overview"
weight : 2010
menu:
  docs:
    parent: futures
    identifier: "futures_overview"
---

Futures, hinted at earlier in the guide, are the building block used to manage
asynchronous logic. They are the underlying asynchronous abstraction used by
Tokio.

A future is a value that represents the completion of an asynchronous
computation. Usually, the future _completes_ due to an event that happens
elsewhere in the system. While we’ve been looking at things from the perspective
of basic I/O, you can use a future to represent a wide range of events, e.g.:

* **A database query**, when the query finishes, the future is completed, and
  its value is the result of the query.

* **An RPC invocation** to a server. When the server replies, the future is
  completed, and its value is the server’s response.

* **A timeout**. When time is up, the future is completed, the value is an empty tuple
  `()` (also referred to as "unit" or "the unit type").

* **A long-running CPU-intensive task**, running on a thread pool. When the task
  finishes, the future is completed, and its value is the return value of the
  task.

* **Reading bytes from a socket**. When the bytes are ready, the future is
  completed – and depending on the buffering strategy, the bytes might be
  returned directly, or written as a side-effect into some existing buffer.

Applications built with Tokio are structured in terms of futures. Tokio takes
these futures and drives them to completion.
