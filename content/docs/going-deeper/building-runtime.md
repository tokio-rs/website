+++
title = "Building a runtime"
description = "How a runtime is constructed and customized"
menu = "going_deeper"
weight = 250
+++

The runtime ‒ all the pieces needed to run an event driven application ‒ is
already available. You don't *need* to know this if you want to just use tokio.
However, it may be useful to know what happens under the hood, both to gain some
more understanding of the details in case something goes wrong, and to be able
to customize it beyond what the [runtime `Builder`] supports.

We are going to build a single threaded runtime, because it is slightly simpler
to put together. Not that the default multi threaded one would be conceptually
more complex, but there are more moving parts around. Knowing the details here
can be a stepping stone to reading the code of the default runtime.

A complete, working example of things discussed here can be found in the
[git repository](https://github.com/tokio-rs/tokio/tree/master/examples/single-threaded.rs).

## The `Park` trait

The asynchronous world is inherently about *waiting* for something to happen
(and being able to wait for multiple things at once). It is no surprise there's
a trait to abstract over the waiting. It's called [`Park`].

The idea is, if there's nothing better to do, the control is passed to the
`Park` until something interesting happens and the control is taken away from it
again or until some specified time passes. It is up to the `Park` how it spends
this time. It can either do something useful (processing background jobs) or
simply block the thread in some way.

Some things are the bottom `Park` implementations ‒ they somehow block the
thread. Other things implementing the trait only delegate the park calls to some
underlying object they wrap (with some added functionality), allowing to stack
things onto each other.

## The usual components

We definitely need a [`Reactor`] to accept external events (like network sockets
being readable) from the OS. It does so by blocking on `epoll`, `kqueue` or
other OS-dependent primitive, through the [mio] crate. This can't delegate the
waiting to anything else, so reactor goes to the bottom of our stack.

The reactor is able to notify our futures of data coming over the network and
similar events, but we need an executor to actually run them. We'll be using the
[`CurrentThread`] executor, because we're building a single-threaded runtime.
Use any other executor that suits your needs. The executor needs a `Park`
underneath to wait when there are no futures ready to run. It doesn't implement
`Park`, therefore it must go on the top of the whole stack.

While not strictly necessary, it is useful to be able to run delayed futures ‒
timeouts and similar. Therefore, we place the [`Timer`] in the middle ‒
fortunately, it can be placed on top of one `Park` and also implements `Park`.
This plays a similar role for timeouts as reactor does for IO-based futures.

In addition, any custom layer can be added. One example could be some kind of
idle bookkeeping component ‒ it would try to repeatedly do a bit of work if
asked to wait and interleave it with letting the park below it also pick up
events. If there was no bookkeeping to be done, it would simply delegate the
waiting.

This is how the creation of the reactor, timer and executor would look like in
code:

```rust
# extern crate futures;
# extern crate tokio;
# extern crate tokio_executor;
# extern crate tokio_reactor;
# extern crate tokio_timer;
#
# use std::io::Error as IoError;
# use std::time::{Duration, Instant};
#
# use futures::{future, Future};
# use tokio::executor::current_thread::{self, CurrentThread};
# use tokio_reactor::Reactor;
# use tokio_timer::timer::{self, Timer};
# fn run<F: Future<Item = (), Error = std::io::Error>>(f: F) -> Result<(), std::io::Error> {
let reactor = Reactor::new()?;
// The reactor itself will get consumed by timer,
// so we keep a handle to communicate with it.
let reactor_handle = reactor.handle();
let timer = Timer::new(reactor);
let timer_handle = timer.handle();
let mut executor = CurrentThread::new_with_park(timer);
# Ok(())
# }
# fn main() {
#      run(futures::future::lazy(|| Ok(()))).unwrap();
# }
```

This way, if they are futures to execute, they'll get executed first. Then once
it runs out of ready futures, it'll look for timeouts to fire. This may generate
some more ready futures (which would get executed next). If no timeouts fire,
the timer computes for how long the reactor can safely block and lets it wait
for external events.

## Global state

We've built the components that do the actual work. But we need a way to build
and submit the work to them. We could do so through the handles, but to do that,
we would have to carry them around which would be far from ergonomic.

To avoid the tedious passing of several handles around, the built-in runtime
stores them in a thread local storage. Several modules in tokio have a
`with_default` method, which takes the corresponding handle and a closure. It
stores the handle in the thread local storage and runs the closure. It then
restores the original value of the TLS after the closure finishes.

This way we would run a future with all the default values set, so it can freely
use them:

```rust
# extern crate futures;
# extern crate tokio;
# extern crate tokio_executor;
# extern crate tokio_reactor;
# extern crate tokio_timer;
#
# use std::io::Error as IoError;
# use std::time::{Duration, Instant};
#
# use futures::{future, Future};
# use tokio::executor::current_thread::{self, CurrentThread};
# use tokio_reactor::Reactor;
# use tokio_timer::timer::{self, Timer};
# fn run<F: Future<Item = (), Error = std::io::Error>>(f: F) -> Result<(), std::io::Error> {
# let reactor = Reactor::new()?;
# let reactor_handle = reactor.handle();
# let timer = Timer::new(reactor);
# let timer_handle = timer.handle();
# let mut executor = CurrentThread::new_with_park(timer);
// Binds an executor to this thread
let mut enter = tokio_executor::enter()
    .expect("Multiple executors at once");
// Set the defaults before running the closure
let result = tokio_reactor::with_default(
    &reactor_handle,
    &mut enter,
    |enter| timer::with_default(
        &timer_handle,
        enter,
        |enter| {
            let mut default_executor =
                current_thread::TaskExecutor::current();
            tokio_executor::with_default(
                &mut default_executor,
                enter,
                |enter| executor.enter(enter).block_on(f)
            )
        }
    )
);
# Ok(())
# }
# fn main() {
#      run(futures::future::lazy(|| Ok(()))).unwrap();
# }
```

There are few things of note. First, the `enter` thing just ensures that we
don't run multiple executors on the same thread at the same time. Running
multiple executors would get one of them blocked, which would act in a very not
useful way, therefore this is footgun prevention.

Second, we want to use the same executor as the default executor and default
current thread executor, and also to run the executor (not only spawn a future
onto it without further waiting). To do both, we need two mutable references to
it, which is not possible. To work around that, we set the current thread
executor (it actually sets itself, in the `executor.block_on` call, or any
similar one). We use the `TaskExecutor` as the default one, which is a proxy to
whatever current thread executor is configured at the time of its use.

Finally, the `block_on` will execute the single future to completion (and will
process any other futures spawned in the executor as well, but it'll not wait
for them to finish if `f` finishes first). The result of the future is bubbled
upwards through all the `with_default` calls and can be returned or used in any
other way. If you want to wait for all the other futures to finish too, there's
also `executor.run` which can be executed afterwards.

[runtime `Builder`]: {{< api-url "tokio" >}}/runtime/struct.Builder.html
[`Park`]: {{< api-url "tokio-executor" >}}/park/trait.Park.html
[`Reactor`]: {{< api-url "tokio" >}}/reactor/struct.Reactor.html
[mio]: https://crates.io/crates/mio
[`CurrentThread`]: {{< api-url "tokio" >}}/executor/current_thread/struct.CurrentThread.html
[`Timer`]: {{< api-url "tokio-timer" >}}/timer/struct.Timer.html
