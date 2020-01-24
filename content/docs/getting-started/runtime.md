---
title: "Runtime"
weight : 1030
menu:
  docs:
    parent: topics
---

In the previous section we explored `async fn` Futures which allow us to represent
a value that will be available "at some point in the future". We mentioned that
a Rust `Future` requires **something** to poll it for completion and said that
the **something** is the Tokio runtime.

## Tokio runtime

The [`Runtime`] is responsible for repeatedly calling `poll` on a `Future` until
its value is returned. There are a few different ways this can happen in
practice. For example, the [`basic_scheduler`] configuration will block the
current thread and process all spawned tasks in place. The
[`threaded_scheduler`] configuration uses a work-stealing thread pool and
distributes load across multiple threads. The `threaded_scheduler` is the
default for applications and the `basic_scheduler` is the default for tests.

It's important to remember that all async tasks **must** be spawned on the
runtime or no work will be performed.

## Spawning Tasks

One of the unique aspects of Tokio is that futures can be spawned on the runtime
from within other async tasks. Tasks are the application’s “unit of logic”.
They are similar to [Go’s goroutine] and [Erlang’s process], but asynchronous.
In other words, tasks are asynchronous green threads.

Tasks are passed to the runtime, which handles scheduling the task. The runtime
is usually scheduling many tasks across a single or small set of threads. Tasks
must not perform computation-heavy logic or they will prevent other tasks from
executing. So don’t try to compute the fibonacci sequence as a task!

We can spawn tasks using `tokio::spawn`. For example:

```rust
#[tokio::main]
async fn main() {
    let handle = tokio::spawn(async {
        println!("doing some work, asynchronously");

        // Return a value for the example
        "result of the computation"
    });

    // Wait for the spawned task to finish
    let res = handle.await;

    println!("got {:?}", res);
}
```

Again spawning tasks can happen within other futures or streams allowing
multiple things to happen concurrently. In the above example we're spawning the
inner future from within the outer stream. Each time we get a value from the
stream we'll simply run an inner future.

In the next section, we'll take a look at a more involved example than our hello-
world example that takes everything we've learned so far into account.

[`Runtime`]: https://docs.rs/tokio/0.2/tokio/runtime/struct.Runtime.html
[`basic_scheduler`]: https://docs.rs/tokio/0.2/tokio/runtime/struct.Builder.html#method.basic_scheduler
[`threaded_scheduler`]: https://docs.rs/tokio/0.2/tokio/runtime/struct.Builder.html#method.threaded_scheduler
