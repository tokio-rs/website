---
title: "Timers"
weight: 7010
menu:
  docs:
    parent: going_deeper
---

When writing a network based application, it is common to need to perform
actions based on time.

* Run some code after a set period of time.
* Cancel a running operation that takes too long.
* Repeatedly perform an action at an interval.

These use cases are handled by using the various timer APIs that are provided in
the [timer] module.

# Running code after a period of time

In this case, we want to perform a task after a set period of time. To do this,
we use the [`Delay`][delay] API. All we will do is write `"Hello world!"` to the
terminal, but any action can be taken at this point.

```rust
# #![deny(deprecated)]
# extern crate tokio;
#
use tokio::prelude::*;
use tokio::timer::Delay;

use std::time::{Duration, Instant};

fn main() {
    let when = Instant::now() + Duration::from_millis(100);
    let task = Delay::new(when)
        .and_then(|_| {
            println!("Hello world!");
            Ok(())
        })
        .map_err(|e| panic!("delay errored; err={:?}", e));

    tokio::run(task);
}
```

The above example creates a new `Delay` instance that will complete 100
milliseconds in the future. The `new` function takes an `Instant`, so we compute
`when` to be the instant 100 milliseconds from now.

Once the instant is reached, the `Delay` future completes, resulting in the
`and_then` block to be executed.

As with all futures, `Delay` is lazy. Simply creating a new `Delay` instance
does nothing. The instance must be used on a task that is spawned onto the Tokio
[runtime]. The [runtime] comes preconfigured with a timer implementation to
drive the `Delay` instance to completion. In the example above, this is done by
passing the task to `tokio::run`. Using `tokio::spawn` would also work.

# Timing out a long running operation

When writing robust networking applications, it's critical to ensure that
operations complete within reasonable amounts of time. This is especially true
when waiting for data from external, potentially untrusted, sources.

The [`Timeout`][timeout] type ensures that an operation completes by a specified
instant in time.

```rust
# #![deny(deprecated)]
# extern crate tokio;
#
use tokio::io;
use tokio::net::TcpStream;
use tokio::prelude::*;

use std::time::{Duration, Instant};

fn read_four_bytes(socket: TcpStream)
    -> Box<Future<Item = (TcpStream, Vec<u8>), Error = ()>>
{
    let buf = vec![0; 4];
    let fut = io::read_exact(socket, buf)
        .timeout(Duration::from_secs(5))
        .map_err(|_| println!("failed to read 4 bytes by timeout"));

    Box::new(fut)
}
# pub fn main() {}
```

The above function takes a socket and returns a future that completes when 4
bytes have been read from the socket. The read must complete within 5 seconds.
This is ensured by calling `timeout` on the read future with a duration of 5
seconds.

The [`timeout`] function is defined by [`FutureExt`][ext] and is included in the
prelude. As such, `use tokio::prelude::*` imports [`FutureExt`][ext] as well, so
we can call [`timeout`] on all futures in order to require them to complete by
the specified instant.

If the timeout is reached without the read completing, the read operation is
automatically canceled. This happens when the future returned by
`io::read_exact` is dropped. Because of the lazy runtime model, dropping a
future results in the operation being canceled.

# Running code on an interval

Repeatedly running code on an interval is useful for cases like sending a PING
message on a socket, or checking a configuration file every so often. This can
be implemented by repeatedly creating [`Delay`][delay] values. However, because
this is a common pattern, [`Interval`][interval] is provided.

The [`Interval`] type implements `Stream`, yielding at the specified rate.

```rust
# #![deny(deprecated)]
# extern crate tokio;
#
use tokio::prelude::*;
use tokio::timer::Interval;

use std::time::{Duration, Instant};

fn main() {
    let task = Interval::new(Instant::now(), Duration::from_millis(100))
        .take(10)
        .for_each(|instant| {
            println!("fire; instant={:?}", instant);
            Ok(())
        })
        .map_err(|e| panic!("interval errored; err={:?}", e));

    tokio::run(task);
}
```

The above example creates an `Interval` that yields every 100 milliseconds
starting now (the first argument is the instant at which the `Interval` should
first fire).

By default, an `Instant` stream is unbounded, i.e., it will continue yielding at
the requested interval forever. The example uses `Stream::take` to limit the
number of times `Interval` yields, here limiting to a sequence of 10 events.
So, the example will run for 0.9 seconds since the first of 10 values is yielded
immediately.

# Notes on the timer

The Tokio timer has a granularity of one millisecond. Any smaller interval is
rounded up to the nearest millisecond. The timer is implemented in user land
(i.e., does not use an operating system timer like `timerfd` on linux). It uses
a hierarchical hashed timer wheel implementation, which provides efficient
constant time complexity when creating, canceling, and firing timeouts.

The Tokio runtime includes one timer instance **per worker thread**. This means
that, if the runtime starts 4 worker threads, there will be 4 timer
instances. This allows avoiding synchronization in most cases since the task,
when working with a timer, will be operating on state located on the current
thread.

That said, the timer implementation is thread safe and supports usage from
any thread.

[timer]: {{< api-url "tokio" >}}/timer/index.html
[delay]: {{< api-url "tokio" >}}/timer/struct.Delay.html
[timeout]: {{< api-url "tokio" >}}/timer/struct.Timeout.html
[interval]: {{< api-url "tokio" >}}/timer/struct.Interval.html
[runtime]: {{< api-url "tokio" >}}/runtime/index.html
[ext]: {{< api-url "tokio" >}}/util/trait.FutureExt.html
[`timeout`]: {{< api-url "tokio" >}}/util/trait.FutureExt.html#method.timeout
