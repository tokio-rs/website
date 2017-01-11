+++
title = "Tasks and executors"
description = "The guts of the task system"
menu = "going_deeper"
weight = 108
+++

The concepts of a tasks for futures were introduced in [the futures model in
depth]({{< relref "futures-model.md" >}}), but here we're going to dig into
their mechanics much more deeply along with examples of how to implement various
execution models. Here we'll explore three separate methods of executing futures
in depth:

* [On the current thread](#exploring-wait)
* [On a thread pool](#futures-cpupool)
* [On an event loop](#tokio-core)

Finally we'll explore the concept of [unpark events](#unpark-events) in depth if
you're curious about more than the [high level overview]({{< relref
"futures-model.md#wakeup-cause" >}}).

**This material is mostly relevant for those wishing to build their own executors
(e.g., custom thread pools)**, but understanding it can be helpful for
internalizing the futures model more deeply.

## [Exploring `Future::wait`](#exploring-wait) {#exploring-wait}

Let's start out our tour of tasks and executors with a deep dive into the
implementation of the [`wait`] method on the [`Future`] trait. To recap, this
method will block the current thread until the future has been resolved,
returning the result of the future at that time. That can happen either through
work done on the thread running [`wait`], or elsewhere.

[`wait`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.wait
[`Future`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html

Let's take a look at the method itself:

```rust,ignore
fn wait(self) -> Result<Self::Item, Self::Error>
    where Self: Sized
{
    executor::spawn(self).wait_future()
}
```

Well that was pretty simple! Here we're just calling the [`spawn`] function
followed by the [`wait_future`] method. Recall that tasks are, in the end, just
a "big" future (usually made up of many sub-futures). The [`spawn`] method is
the basic way to turn a future into a task, which means that we can no longer
compose it with other futures, but we can *execute* it. The method creates a new
instance of the [`Spawn`] type with associated data required to create the
future's task. Once this is done, the real meat happens in the [`wait_future`]
method, so let's take a look at that:

[`spawn`]: https://docs.rs/futures/0.1/futures/executor/fn.spawn.html
[`wait_future`]: https://docs.rs/futures/0.1/futures/executor/struct.Spawn.html#method.wait_future
[`Spawn`]: https://docs.rs/futures/0.1/futures/executor/struct.Spawn.html

```rust,ignore
fn wait_future(&mut self) -> Result<F::Item, F::Error> {
    let unpark = Arc::new(ThreadUnpark::new(thread::current()));
    loop {
	match try!(self.poll_future(unpark.clone())) {
	    Async::NotReady => unpark.park(),
	    Async::Ready(e) => return Ok(e),
	}
    }
}
```

There's going to be a few new concepts here, so we'll go line-by-line:

```rust,ignore
let unpark = Arc::new(ThreadUnpark::new(thread::current()));
```

First we create an instance of the [`Unpark`] trait, in this case
`Arc<ThreadUnpark>`. Recall that "unpark" for a future's task is akin to
unblocking it, similar to how [`Thread::unpark`] in the standard library will
wake up that thread. In fact, that's the exact implementation of `Unpark for
ThreadUnpark`:

```rust,ignore
impl Unpark for ThreadUnpark {
    fn unpark(&self) {
        self.ready.store(true, Ordering::SeqCst);
        self.thread.unpark()
    }
}
```

In general, [`Unpark`] is used to notify a task that it should be woken, which
in this case means waking up the thread running [`wait_future`]. As we'll see,
other executors have other ways of "waking up" a task.

The [`Unpark`] implementation has some extra state to resolve races (the
`ready` flag), and we'll see more of that in a moment. In the meantime let's
take a look at the remaining lines of the [`wait_future`] method:

[`Unpark`]: https://docs.rs/futures/0.1/futures/executor/trait.Unpark.html
[`Thread::unpark`]: https://doc.rust-lang.org/std/thread/struct.Thread.html#method.unpark

```rust,ignore
loop {
    match try!(self.poll_future(unpark.clone())) {
	Async::NotReady => unpark.park(),
	Async::Ready(e) => return Ok(e),
    }
}
```

This is the main loop which is going to drive the future forward. We will
continually poll the future through the [`poll_future`] method on [`Spawn`].
Internally this method will call the [`poll`] method, but set things up so that
calls to [`park`] within the future will correctly tie in to our [`Unpark`]
implementation (this is done using a thread local). The [`poll_future`] method
is the main way to "enter a task".

The [`poll_future`] method takes one argument: an `Arc<Unpark>`. We previously
created an instance which will unblock our thread. This means that on each
iteration of the loop we just pass in a clone of this instance.

Take note while we're here that this is where the "one allocation required"
guarantee comes into play we saw before. The `Arc<Unpark>` is the only
allocation necessary for this entire method, and otherwise we're not allocating
any memory. Crucially we're **reusing the same instance of `Unpark` for all
calls to `poll`**, and this same instance is used for the entire lifetime of the
future. This reuse allows us to have a very efficient implementation of
[`wait_future`].

Finally after [`poll_future`] returns we'll have a `Poll<T, E>` on our hands
returned from the future itself. We propagate errors through `try!` and
immediately return `Ready` values. The interesting bit happens on the `NotReady`
portion. Recall that we're just blocking the current thread until the future is
finished, so we're just going to call [`thread::park`] here from the standard
library. To get a better idea, let's take a look at the `ThreadUnpark::park`
function we're calling:

```rust,ignore
fn park(&self) {
    if !self.ready.swap(false, Ordering::SeqCst) {
        thread::park();
    }
}
```

Here we check to see if `ready` is still `false`. If so, we call
[`thread::park`]. This means that if after receiving a `NotReady` and before we
call park, if an unpark happens it'll store `true` to `ready` (as we saw above
in `Unpark for ThreadUnpark`). If this hasn't happened, though, then we block
the current thread. The current thread will then get reawoken once the future's
task is unparked, through the `ThreadUnpark` instance associated with this
future.

[`poll_future`]: https://docs.rs/futures/0.1/futures/executor/struct.Spawn.html#method.poll_future
[`poll`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#tymethod.poll
[`park`]: https://docs.rs/futures/0.1/futures/task/fn.park.html
[`thread::park`]: https://doc.rust-lang.org/std/thread/fn.park.html

That concludes the initial whirlwhind tour of the [`spawn`] method and the
[`Unpark`] trait, lynchpins of the execution model of futures. We've seen how
the [`wait`] method leverages these functions to create a task and then
immediately call the future's [`poll`] function until it returns its ready. The
"executor" in this case is the current thread, so all code for the future runs
on the current thread. Additionally the [`Task`] handles returned from
[`park`] while the future is being polled contain an embedded reference to our
instance of [`Unpark`], which we've configured to wake up the thread if it's
blocking.

[`Task`]: https://docs.rs/futures/0.1/futures/task/struct.Task.html

## [Executors in `futures-cpupool`](#futures-cpupool) {#futures-cpupool}

Now that we've taken a look at a relatively simple executor (the current
thread), let's take a look at a slightly more complex case: a thread pool.  The
[`futures-cpupool`] crate provides a [`CpuPool`] type, which is a thread pool
for executing any number of futures to completion.

Here's the main interface that the [`CpuPool`] exposes, the
[`spawn`][cpu-spawn] method:

```rust,ignore
fn spawn<F>(&self, f: F) -> CpuFuture<F::Item, F::Error>
    where F: Future + Send + 'static,
          F::Item: Send + 'static,
          F::Error: Send + 'static
```

Here we're going to take a future, `F`, and run it to completion (spawn it) on
the thread pool. This future must be sendable across threads (`Send`) along with
the result of the future. Additionally, we can't have any interior `&'a`
references for safety reasons.

The [`spawn`][cpu-spawn] function will return a new future, [`CpuFuture`], which
represents the value of the future spawned onto the thread pool. This
[`CpuFuture`] has the same item/error types as the future we pass in.
Additionally it will propagate panics so if `f` panics during a [`poll`] then
the returned future will also panic on the next [`poll`].

[`futures-cpupool`]: https://github.com/alexcrichton/futures-rs/tree/master/futures-cpupool
[`CpuPool`]: https://docs.rs/futures-cpupool/0.1/futures_cpupool/struct.CpuPool.html
[cpu-spawn]: https://docs.rs/futures-cpupool/0.1/futures_cpupool/struct.CpuPool.html#method.spawn
[`CpuFuture`]: https://docs.rs/futures-cpupool/0.1/futures_cpupool/struct.CpuFuture.html

With that out of the way let's dive into the source of [`spawn`]:

```rust,ignore
fn spawn<F>(&self, f: F) -> CpuFuture<F::Item, F::Error>
    where F: Future + Send + 'static,
          F::Item: Send + 'static,
          F::Error: Send + 'static,
{
    let (tx, rx) = oneshot::channel();
    let sender = Sender {
        fut: AssertUnwindSafe(f).catch_unwind(),
        tx: Some(tx),
    };
    executor::spawn(sender).execute(self.inner.clone());
    CpuFuture { inner: rx }
}
```

Here we're creating a [oneshot channel] to bridge the thread pool and the
returned future. On the thread pool we'll complete the `tx` and and the `rx` end
is the returned [`CpuFuture`]. A small wrapper, `Sender` is created to own the
future `f` and the `tx` sender. This struct is itself a future which simply runs
`f` to completion, sending the completed value on `tx`.

[oneshot channel]: https://docs.rs/futures/0.1/futures/sync/oneshot/index.html

After we've created the `sender` then we see our familiar executor [`spawn`]
method.  We just saw that this is where we tie off a future and a task is
created.  Unlike before, however, we then see a new method called,
[`execute`]. This method consumes ownership of the [`Spawn`] and will run it to
completion on an instance of the [`Executor`] trait provided; it automatically
takes care of the unpark details we mentioned before.

[`execute`]: https://docs.rs/futures/0.1/futures/executor/struct.Spawn.html#method.execute
[`Executor`]: https://docs.rs/futures/0.1/futures/executor/trait.Executor.html

What's happening here is that after we've fused a future and its task we're then
requesting that it run to completion on the [`Executor`] we provide it. The
[`CpuPool`] internals implement this trait, and are passed in as the
implementation of [`Executor`]. The [`Executor`] trait is pretty simple:

```rust,ignore
trait Executor: Send + Sync + 'static {
    fn execute(&self, r: Run);
}
```

An executor just knows how to run units of work, encapsulated in a [`Run`]. The
[`Run`] structure opaquely contains a future which it will poll when the
[`run`][run-run] method is called.

[`Run`]: https://docs.rs/futures/0.1/futures/executor/struct.Run.html
[run-run]: https://docs.rs/futures/0.1/futures/executor/struct.Run.html#method.run

With that in mind our thread pool has a relatively simple task now. We need to
implement the [`Executor`] trait, and then we'll be given units of work to
execute. As a thread pool we'll want to execute all that work on the thread pool
itself. Sounds easy enough! Let's take a look at the thread pool's
implementation of the [`Executor`] trait:

```rust,ignore
fn execute(&self, run: Run) {
    self.queue.push(Message::Run(run))
}
```

Aha looks like it does exactly what we'd expect! The thread pool has an
internal `queue` which can be concurrently pushed on to. Each time we're
requested to run a unit of work we push an appropriate message onto the queue.
To get an idea of when the work is actually run, let's take a look at the code
each worker thread is executing:

```rust,ignore
fn work(inner: &Inner) {
    loop {
        match inner.queue.pop() {
            Message::Run(r) => r.run(),
            Message::Close => break,
        }
    }
}
```

As we might expect this is just a continual loop over messages in the queue. If
we get a `Run` message, we run the contained unit of work. If we get a `Close`
message then we just exit the worker thread.

### [`Executor` under the hood](#executor-detail) {#executor-detail}

Ok we just went from zero to "we implemented a thread pool" very quickly there!
Clearly there's quite a bit happening in the [`execute`] method we called
earlier. The exact code here is a little tricky with synchronization, so we'll
just approach it at a high level here instead of going through all the
nitty-gritty details.

The [`execute`] method has an instance of a spawned future, [`Spawn`] in
addition to an executor (specifically an `Arc<Executor>`). It's purpose is then
to execute the future to completion on the executor by submitting work to it via
the executor's sole method.

Initially we'll just directly submit the future to the executor. The [`Run`] we
submit contains the future itself, and when the [`run`][run-run] method is
called we'll poll the future. If the future is ready, then we're done! Unlike
[`wait_future`] above the [`execute`] method requires the item/error types to be
`()` as they'll just be dropped once the future is done.

If the future is not ready, however, then the real magic happens. While the
future was being polled the [`execute`] method configures a custom instance of
[`Unpark`] to be available. This instance transitively contains a reference to
the executor, and may also contain a reference to the future itself. This means
that once a future returns that it's not ready we simply return from the `run`
function (modulo some synchronization).

When `unpark` is called then it will attempt to resubmit work to the executor.
These calls are synchronized to enusre that the future is submitted only once.

And with all that we've now also completed our tour of how [`CpuPool`] works!
We saw that we used [`spawn`] to create a task like [`wait`], but then we
leveraged the new [`execute`] method to run the future instead. This method is
more restrictive on the types of futures that it can accept, but it works by
essentially submitting work to an executor whenever it's available. Futures that
block will be resubmitted to the queue once they've been unblocked through the
`unpark` method.

## [Executors in `tokio-core`](#tokio-core) {#tokio-core}

The [`wait`] method we [explored earlier](#exploring-wait) had an interesting
restriction that it required the future to be completed by another thread (or
inline). Additionally the [`CpuPool`] type requires futures to be `Send +
'static`. Often, though, we've got futures which don't meet either of these
restrictions! For example we might have some I/O work that needs to execute an
event loop or perhaps a future that contains an `Rc<RefCell<T>>`. For these
futures we execute them on a [`Core`] in [`tokio-core`] directly rather than
through the previous execution methods.

[`tokio-core`]: https://github.com/tokio-rs/tokio-core
[`Core`]: https://docs.rs/tokio-core/0.1/tokio_core/reactor/struct.Core.html

Our [early understanding]({{< relref "reactor.md" >}}) of events loops has shown
us that event loops are just simultaneously waiting for a large number of events
to happen, and then executing some code based on what event happened. Both
[`wait`] and [`CpuPool`] before achieved blocking via [`thread::park`], one on
the thread calling [`wait`] and the other in a pool of threads when there's no
more work to do. Event loops, however, block waiting for any one of a number of
events to occur. In the context of an event loop for futures we're going to
interpret events here as either I/O events or as unpark requests from futures on
the event loop.

The event loop that [`tokio-core`] builds on, [`mio`], supports arbitrary event
sources for an event loop (the [`Registration`] and [`SetReadiness`] types). In
Tokio this is leveraged to assign each future its own "token" in addition to all
I/O sources having a unique token. That way we can literally use the [`mio`]
event loop to block for a list of events related to either futures or I/O.

All I/O events in [`tokio-core`] are associated with a parked task. We saw
[earlier]({{< relref "core-low-level.md" >}}) that when a future performs I/O it
will implicitly park the task and register that with an I/O object when the I/O
returns "would block". This makes our dispatch for I/O events pretty easy, we
just wake up the task!

For events related to futures the [`tokio-core`] event loop then just polls the
appropriate future (according to the token [`mio`] provides). If the future is
done then resources with it are deallocate and otherwise it's register to
reawaken the event loop when it's ready.

As an executor the [`Core`] type is responsible for providing an implementation
of [`Unpark`] when polling futures. This implementation just needs to wake up
the event loop, so for all futures it's just the [`SetReadiness`] type that
[`mio`] provides. This type, when set to ready, will wake up the event loop and
notify which future needs to get polled.

[`mio`]: https://github.com/carllerche/mio
[`Registration`]: https://docs.rs/mio/0.6/mio/struct.Registration.html
[`SetReadiness`]: https://docs.rs/mio/0.6/mio/struct.SetReadiness.html

## [Unpark Events](#unpark-events) {#unpark-events}

Earlier when diving into the futures model we [saw a brief mention]({{< relref
"futures-model.md#wakeup-cause" >}}) of "unpark events". These structures allow
futures to communicate precisely what happens during an unpark to allow finer
granularity of inspecting many sources of events.

For example, let's consider how the `join` combinator works. Currently it simply
polls the two futures it contains when it itself is polled. During this
operation both futures register interest in their event sources, and eventually
one of them will be woken up. When we re-poll the `join` combinator, though,
we'll poll both futures again! Despite only one future being ready we did some
extra work on the next [`poll`].

Now with only two futures the extra work here may not matter much. If this is
scaled to thousands or millions, however, it can be quite significant!
Essentially what we need is the ability to communicate which sub-future woke
up and cause a re-poll. This is precisely what unpark events are!

Unpark events are primarily used through [`with_unpark_event`]:

[`with_unpark_event`]: https://docs.rs/futures/0.1/futures/task/fn.with_unpark_event.html

```rust,ignore
fn with_unpark_event<F, R>(event: UnparkEvent, f: F) -> R
    where F: FnOnce() -> R
```

This function takes an [`UnparkEvent`] and a closure to execute. While the
closure is executing if [`park`] is called then a special [`Task`] handle is
returned. [`Task`] handles returned in the scope of a [`with_unpark_event`] call
will do extra work on an `unpark`, specifically running all unpark events before
calling the inner [`Unpark`] itself. This "exta work" is defined by the
[`UnparkEvent`], which is constructed with an [`EventSet`] and a `usize`.
Essentially when a task is unparked, it will take all unpark events and call
[`insert`] with the [`EventSet`] and `usize` specified.

[`UnparkEvent`]: https://docs.rs/futures/0.1/futures/task/struct.UnparkEvent.html
[`EventSet`]: https://docs.rs/futures/0.1/futures/task/trait.EventSet.html
[`insert`]: https://docs.rs/futures/0.1/futures/task/trait.EventSet.html#tymethod.insert

To get a better idea of how you might use this, let's take a look at some
pseudo-code of how you might use this in join:

```rust,ignore
fn poll(&mut self) -> Poll<(A::Item, B::Item), A::Error> {
    if !self.left.is_done() && self.set.contains(1) {
        let event = UnparkEvent::net(self.set.clone(), 1);
        task::with_unpark_event(event, || {
            self.left.poll();
        });
    }

    if !self.right.is_done() && self.set.contains(2) {
        let event = UnparkEvent::net(self.set.clone(), 2);
        task::with_unpark_event(event, || {
            self.right.poll();
        });
    }

    // ...
}
```

Here we see a few crucial pieces of using unpark events. First and foremost
they're used in the implementation of [`poll`] methods. Next we see that calls
to [`poll`] of inner futures are always guarded. We don't actually poll inner
futures it their token isn't in our current "event set".

If it is, however, then we *always* poll the future inside of a
`with_unpark_event` block. This means that tasks created by [`park`] during
these blocks will insert the specified token into our set when unparked. Also
note that the usage of `Arc` here means that only one allocation is made for the
entire lifetime of the future.

Your own usage of unpark events may be a little more complicated than this,
however. You may want to take a look at their usage in the [`buffer_unordered`
combinator] or the [`futures_unordered` combinator] which handle many of the
subtleties of working with unpark events.

[`buffer_unordered` combinator]: https://github.com/alexcrichton/futures-rs/blob/master/src/stream/buffer_unordered.rs
[`futures_unordered` combinator]: https://github.com/alexcrichton/futures-rs/blob/master/src/stream/futures_unordered.rs
