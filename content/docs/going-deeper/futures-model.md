+++
title = "The futures-rs model in depth"
description = "Understanding how futures, streams and sinks work"
menu = "going_deeper"
weight = 102
+++

At this point, we're ready to dig into the implementation details for futures,
streams and sinks. You'll be armed with the tools needed to write your own
direct implementations of these traits, rather than relying solely on the
combinator API.

All three abstractions rest on the same core ideas:

- Making progress on async computations by *demand*, rather than letting them
proceed on their own.

- Encapsulating async computations into *tasks*, which are essentially
  lightweight threads (and the basic unit of concurrency in `futures-rs`).

To understand both of these points, we'll walk through the story with a focus on
futures. We'll then touch on streams and sinks at the end.

## [Revisiting the `Future` trait](#revisiting) {#revisiting}

Let's take another look at the core definition of the `Future` trait, this time
paying more attention to the required `poll` method:

```rust
trait Future {
    // The type of value that the future yields on successful completion.
    type Item;

    // The type of value that the future yields on failure.
    type Error;

    // The only required method, which attempts to complete the future.
    fn poll(&mut self) -> Poll<Self::Item, Self::Error>;

    // ... and the various defaulted method
}

type Poll<T, E> = Result<Async<T>, E>;

enum Async<T> {
    /// Represents that a value is immediately ready.
    Ready(T),

    /// Represents that a value is not ready yet, but may be so later.
    NotReady,
}
```

The `poll` method attempts to make progress on the future, for example
retrieving bytes from a network socket if they're required and are available.
The method has several outcomes:

* `Ok(Async::Ready(t))`: successful completion with the value `t`.
* `Ok(Async::NotReady)`: could not currently complete. (This is an
  abstraction of `EWOULDBLOCK` from the Unix world).
* `Err(e)`: completed with an error `e`.

After completion of any kind, it is a contract violation to poll a future
again. (You can use [`fuse`] to work around that if need be.)

[`fuse`]: https://docs.rs/futures/0.1.7/futures/future/trait.Future.html#method.fuse

In the async I/O world, this kind of interface is sometimes referred to as
*readiness-based*, because events are signaled based on "readiness" of
operations (e.g. bytes on a socket being ready) followed by an attempt to
complete an operation;
[Linux's epoll](http://man7.org/linux/man-pages/man7/epoll.7.html) is based on
this model. You can read more about the tradeoffs for this design in
[the blog post that describes it](http://aturon.github.io/blog/2016/09/07/futures-design/).

But there's a big question: after `NotReady` is returned, who polls the future,
and when do they do so?

Let's take a concrete example. If a future is attempting to read bytes from a
socket, that socket may not be ready for reading, in which case the future can
return `NotReady`. *Somehow*, we must arrange for the future to later be "woken
up" (by calling `poll`) once the socket becomes ready. That kind of wakeup is
the job of the [event loop](../../getting-started/reactor). But now we need some
way to connect the signal at the event loop back to continuing to poll the
future.

The solution forms the other main component of the design: tasks.

### [The cornerstone: tasks](#tasks) {#tasks}

**A *task* is a future that is being executed**. That future is almost always
made up of a chain of other futures, like the following one:

```rust
id_rpc(&my_server).and_then(|id| {
    get_row(id)
}).map(|row| {
    json::encode(row)
}).and_then(|encoded| {
    write_string(my_socket, encoded)
})
```

The key point is that there's a difference between functions like `and_then`,
`map` and `join`, which *combine* futures into bigger futures, and functions that
*execute* futures, like:

- The `wait` method, which simply runs the future as a task pinned to the
  current thread, blocking that thread until a result is produced and returned.

- The `spawn` method on a thread pool, which launches a future as an independent
  task on the pool.

These execution functions create a task that contains the future and is
responsible for polling it. In the case of `wait`, polling takes place
immediately; for `spawn`, polling happens once the task is *scheduled* onto a
worker thread.

However polling begins, if any of the interior futures produced a `NotReady`
result, it can grind the whole task to a halt—the task may need to wait for some
event to occur before it can continue. In synchronous I/O, this is where a
thread would block. Tasks provide an equivalent to this model: the task "blocks"
by yielding back to its executor, **after installing itself as a callback for
the events it's waiting on**.

[`park`]: https://docs.rs/futures/0.1.7/futures/task/fn.park.html
[`unpark`]: https://docs.rs/futures/0.1.7/futures/task/fn.park.html
[`Task`]: https://docs.rs/futures/0.1.7/futures/task/struct.Task.html

Returning to the example of reading from a socket, on a `NotReady` result the
task can be added to the event loop's dispatch table, so that it will be woken
up when the socket becomes ready, at which point it will re-`poll` its future.
Crucially, though, the task instance stays fixed for the lifetime of the future
it is executing—**so no allocation is needed to create or install this callback**.

Completing the analogy with threads, tasks provide a [`park`]/[`unpark`] API for
"blocking" and wakeup:

```rust
/// Returns a handle to the current task to call unpark at a later date.
fn park() -> Task;

impl Task {
    /// Indicate that the task should attempt to poll its future in a timely fashion.
    fn unpark(&self);
}
```

Blocking a future is a matter of using [`park`] to get a handle to its task,
putting the resulting [`Task`] in some wakeup queue for the event of interest,
and returning `NotReady`. When the event of interest occurs, the [`Task`] handle
can be used to wake back up the task, e.g. by rescheduling it for execution on a
thread pool. The precise mechanics of [`park`]/[`unpark`] vary by task executor.

In a way, the task model is an instance of "green" (aka lightweight) threading:
we schedule a potentially large number of asynchronous tasks onto a much smaller
number of real OS threads, and most of those tasks are blocked on some event
most of the time. There's an essential difference from Rust's
[old green threading model](https://github.com/aturon/rfcs/blob/remove-runtime/active/0000-remove-runtime.md),
however: **tasks do not require their own stack**. In fact, all of the data
needed by a task is contained within its future. That means we can neatly
sidestep problems of dynamic stack growth and stack swapping, giving us truly
lightweight tasks without any runtime system implications.

Perhaps surprisingly, **the future within a task compiles down to a state
machine**, so that every time the task wakes up to continue polling, it
continues execution from the current state—working just like hand-rolled code
based on [mio](http://github.com/carllerche/mio). This point is most easily seen
by example, so let's revisit `join`.

### [Example: sketching the `join` combinator](#join) {#join}

To implement the `join` combinator, we'll introduce a new concrete type, `Join`,
that tracks the necessary state:

```rust
fn join<F: Future, G: Future>(f: F, g: G) -> Join<F, G> {
    Join::BothRunning(f, g)
}

enum Join<F: Future, G: Future> {
    BothRunning(F, G),
    FirstDone(F::Item, G),
    SecondDone(F, G::Item),
    Done,
}

impl<F, G> Future for Join<F, G> where F: Future, G: Future {
    type Item = (F::Item, G::Item);

    fn poll(&mut self) -> Async<Self::Item> {
        // navigate the state machine
    }
}
```

The first thing to notice is that `Join` is an *enum*, whose variants represent
states in the "join state machine":

- `BothRunning`: the two underlying futures are both still executing.
- `FirstDone`: the first future has yielded a value, but the second is still executing.
- `SecondDone`: the second future has yielded a value, but the first is still executing.
- `Done`: both futures completed, and their values have been returned.

Recall that enums in Rust are represented without requiring any pointers or heap
allocation; instead, the size of the enum is the size of the largest
variant. That's exactly what we want---that size represents the "high water mark"
of this little state machine.

The `poll` method here will attempt to make progress through the state machine
by `poll`ing the underlying futures as appropriate.

Recall that the aim of `join` is to allow its two futures to proceed
concurrently, racing to finish. For example, the two futures might each
represent subtasks running in parallel on a thread pool. When those subtasks are
still running, `poll`ing their futures will return `NotReady`, effectively
"blocking" the `Join` future, while stashing a handle to the ambient `Task` for
waking it back up when they finish. The two subtasks can then race to *wake up*
the `Task`, but that's fine: **the `unpark` method for waking a task is
threadsafe, and guarantees that the task will `poll` its future at least once
after any `unpark` call**. Thus, synchronization is handled once and for all at
the task level, without requiring combinators like `join` to allocate or handle
synchronization themselves.

* You may have noticed that `poll` takes `&mut self`, which means that a given
  future cannot be `poll`ed concurrently—the future has unique access to its
  contents while polling. The `unpark` synchronization guarantees it.

One final point. Combinators like `join` embody "small" state machines, but
because some of those states involve additional futures, they allow additional
state machines to be *nested*. In other words, `poll`ing one of the underlying
futures for `join` may involve stepping through *its* state machine, before
taking steps in the `Join` state machine. **The fact that the use of the
`Future` trait does not entail heap allocation or dynamic dispatch is key to
making this work efficiently.**

In general, the "big" future being run by a task—made up of a large chain of
futures connected by combinators---embodies a "big" nested state machine in just
this way. Once more, Rust's enum representation means that the space required is
the size of the state in the "big" machine with the largest footprint. The space
for this "big" future is allocated in *one shot* by the task, either on the
stack (for the `wait` executor) or on the heap (for `spawn`). After all, the
data has to live *somewhere*---but the key is to avoid constant allocations as
the state machine progresses, by instead making space for the entire thing up
front.

## [Futures at scale](#at-scale) {#at-scale}

We've seen the basics mechaics of futures, but there are a number of concerns
about *robustness* that we also want to cover. It turns out that these concerns
are addressed naturally by the demand-driven `poll` model. Let's take a look at
a few of the most important.

### [Cancellation](#cancellation) {#cancellation}

Futures are often used to represent substantial work that is running
concurrently. Sometimes it will become clear that this work is no longer
needed, perhaps because a timeout occurred, or the client closed a connection,
or the needed answer was found in some other way.

In situations like these, you want some form of *cancellation*: the ability to
tell a future to stop executing because you're no longer interested in its
result.

In the demand-driven model, cancellation largely "falls out". All you have to do
is stop polling the future, instead dropping it. And doing so is usually a
natural consequence of nested state machines like `Join`. Futures whose
computation requires some special effort to cancel (such as canceling an RPC
call) can provide this logic as part of their `Drop` implementation.

### [Backpressure](#backpressure) {#backpressure}

Another essential aspect of at-scale use of futures (and streams and sinks) is
*backpressure*: the ability of an overloaded component in one part of a system
to slow down input from other components. For example, if a server has a backlog
of database transactions for servicing outstanding requests, it should slow down
taking new requests.

Like cancellation, backpressure largely falls out of our model for futures and
streams. That's because tasks can be indefinitely "blocked" by a future/stream
returning `NotReady`, and notified to continue polling at a later time. For the
example of database transactions, if enqueuing a transaction is itself
represented as a future, the database service can return `NotReady` to slow down
requests. Often, such `NotReady` results cascade backward through a system,
e.g. allowing backpressure to flow from the database service back to a
particular client connection then back to the overall connection manager. Such
cascades are a natural consequence of the demand-driven model.

### [Communicating the cause of a wakeup](#wakeup-cause) {#wakeup-cause}

If you're familiar with interfaces like
[epoll](http://man7.org/linux/man-pages/man7/epoll.7.html), you may have noticed
something missing from the `park`/`unpark` model: it provides no way for a task
to know *why* it was woken up.

That can be a problem for certain kinds futures that involve polling a large
number of other futures concurrently—you don't want to have to re-poll
*everything* to discover which sub-future is actually able to make progress.

To deal with this problem, the library offers a kind of "epoll for everyone":
the ability to associate "unpark events" with a given `Task` handle. That is,
there may be various handles to the same task floating around, all of which can
be used to wake the task up, but each of which carries different unpark events.
When woken, the future within the task can inspect these unpark events to
determine what happened. See [`with_unpark_event`] for more detail.

[`with_unpark_event`]: https://docs.rs/futures/0.1.7/futures/task/fn.with_unpark_event.html

## [Streams and sinks](#streams-and-sinks) {#streams-and-sinks}

We've focused primarily on futures above, but streams and sinks work largely the
same way.

Let's start with streams. They have a `poll` function that is very similar to
the one for futures:

```rust
fn poll(&mut self) -> Poll<Option<Self::Item>, Self::Error>;
```

The only difference is that the return value is an `Option`, which works much
like with `Iterator`. The stream is considered terminated after returning either
an error, or completing with `None`.

Sinks are more interesting:

```rust
trait Sink {
    // The type of value that the sink accepts.
    type SinkItem;

    // The type of value produced by the sink when an error occurs.
    type SinkError;

    // The analog to `poll`, used for sending and then flushing items.
    fn start_send(&mut self, item: Self::SinkItem)
                  -> StartSend<Self::SinkItem, Self::SinkError>;
    fn poll_complete(&mut self) -> Poll<(), Self::SinkError>;

    // ... and lots of default methods, as usual
}

type StartSend<T, E> = Result<AsyncSink<T>, E>;

enum AsyncSink<T> {
    /// The `start_send` attempt succeeded, so the sending process has
    /// *started*; you muse use `Sink::poll_complete` to drive the send
    /// to completion.
    Ready,

    /// The `start_send` attempt failed due to the sink being full. The
    /// value being sent is returned, and the current `Task` will be
    /// automatically notified again once the sink has room.
    NotReady(T),
}
```

The key thing that makes sinks different is the potential for buffering. That
means that sending data into a sink is a two-step process: initiating the send,
which may buffer the data, and flushing any buffers to complete the
send. Following our async model, flushing requires repeated polling to drive
toward success, much like a future.

The [`start_send`] method attempts to initiate a send into the sink. If the sink
is ready to accept more data (e.g., it has free buffer space), it will return
`Ok(Ready)`. If it cannot currently accept data, it will return
`Ok(NotReady(m))`, where `m` is the message you were trying to send. Just as
with `Async::NotReady`, this result means that the current task is
*automatically* scheduled to be woken up when the sink becomes ready to take
more data.

After a send is successfully initiated, at some point later the sink should be
flushed (and, in particular, before it is dropped). For that, you use
[`poll_complete`], whose signature matches that of a future that returns `()` on
completion (i.e., when the data has been entirely flushed).

[`start_send`]: https://docs.rs/futures/0.1.7/futures/sink/trait.Sink.html#tymethod.start_send
[`poll_complete`]: https://docs.rs/futures/0.1.7/futures/sink/trait.Sink.html#tymethod.poll_complete
