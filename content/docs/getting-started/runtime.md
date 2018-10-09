---
title: "Runtime"
weight : 1030
menu:
  docs:
    parent: getting_started
---

In the previous section we explored Futures and Streams which allow us to represent
a value (in the case of a `Future`) or a series of values (in the case of `Stream`)
that will be available "at some point in the future". We talked about `poll` on `Future`
and `Stream` which the runtime will call to figure out if the `Future` or the
`Stream` are ready to yield a value.

Lastly, we hinted at the idea of an exectuor which is the specific thing inside the
runtime which polls Futures and Streams driving them to completion. We'll take a
closer look at executors now.

## Executors

In order for a `Future` to make progress, something has to call `poll`. This is the
job of an executor.

Executors are responsible for repeatedly calling `poll` on a `Future` until its value
is returned. There are many different ways to do this and thus many types of executors.
For example, the [`CurrentThread`] executor will block the current thread and loop
through all spawned Futures, calling poll on them. [`ThreadPool`] schedules Futures
across a thread pool. This is also the default executor used by the [runtime][rt].

It's important to remember that all futures **must** be spawned on an executor or no
work will be performed.

## Spawning Tasks

One of the unique aspects of Tokio is that futures can be spawned on the runtime from
within other futures or streams. When we use futures in this way, we usually refer to
them as tasks. Tasks are the application’s “unit of logic”. They are similar to [Go’s
goroutine] and [Erlang’s process], but asynchronous. In other words, tasks are
asynchronous green threads.

Given that a task runs an asynchronous bit of logic, they are represented by the Future
trait. The task’s future implementation completes with a `()` value once the task is
done processing.

Tasks are passed to executors, which handle scheduling the task. An executor usually
is scheduling many tasks across a single or small set of threads. Tasks must not
perform computation heavy logic or they will prevent other tasks from executing. So
don’t try to compute the fibonacci sequence as a task.

Tasks are implemented by either building up a future using the various combinator
functions available in the futures and tokio crates or by implementing the Future
trait directly.

We can spawn tasks using `tokio::spawn`. For example:

```rust
# use std::io::prelude::*;
# let my_future = future::ok(1);
# fn main() {
// Create some kind of future that we want our runtime to execute
let task = my_future.and_then(|my_value| {
  println!("Got a value: {:?}", my_value);
  Ok(())
});

tokio::spawn(task);
# }
```

Again spawning tasks can happen within other futures or streams allowing multiple
things to happen concurrently.

In the next section, we'll take a look at a more involved example than our hello-world
example that takes everything we've learned so far into account.

[`CurrentThread`]: {{< api-url "tokio" >}}/executor/current_thread/index.html
[`ThreadPool`]: http://docs.rs/tokio-threadpool
[rt]: {{< api-url "tokio" >}}/runtime/index.html
[Go's goroutine]: https://www.golang-book.com/books/intro/10
[Erlang's process]: http://erlang.org/doc/reference_manual/processes.html
