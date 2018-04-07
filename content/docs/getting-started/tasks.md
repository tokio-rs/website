+++
title = "Tasks"
description = ""
menu = "getting_started"
weight = 140
+++

Tasks are the application's "unit of logic". They are similar to [Go's
goroutine] and [Erlang's process], but asynchronous. In other words, tasks are
asynchronous green threads.

Given that a task runs an asynchronous bit of logic, they are represented by the
[`Future`] trait. The task's future implementation completes with a `()` value
once the task is done processing.

Tasks are passed to [executors], which handle scheduling the task. An executor
usually is scheduling many tasks across a single or small set of threads.
**Tasks must not perform computation heavy logic or they will prevent other
tasks from executing**. So don't try to compute the fibonacci sequence as a
task.

Tasks are implemented by either implementing the [`Future`] trait directly or by
building up a future using the various combinator functions available in the
[`futures`] and [`tokio`] crates.

Here is an example that fetches the value from a URI using an HTTP get and
caches the result.

The logic is as follows:

1. Check the cache to see if there is an entry for the URI.
2. If there is no entry, perform the HTTP get.
3. Store the response in the cache.
4. Return the response.

The entire sequence of events is also wrapped with a timeout in order to prevent
unbounded execution time.

```rust
# #![deny(deprecated)]
# extern crate futures;
# use futures::prelude::*;
# use futures::future::{self, Either};
# use std::time::Duration;
# fn docx() {
#
# pub struct Timeout;
# impl Timeout {
#     pub fn new<T>(_: T, _: Duration) -> Box<Future<Item = (), Error = ()>> {
#         unimplemented!();
#     }
# }
# pub struct MyExecutor;
# impl MyExecutor {
#     fn spawn<T>(&self, _: T) {
#         unimplemented!();
#     }
# }
# pub struct Error;

// The functions here all return `Box<Future<...>>`. This is one
// of a number of ways to return futures. For more details on
// returning futures, see the "Returning futures" section in
// "Going deeper: Futures".

/// Get a URI from some remote cache.
fn cache_get(uri: &str)
    -> Box<Future<Item = Option<String>, Error = Error>>
# { unimplemented!() } /*
{ ... }
# */

fn cache_put(uri: &str, val: String)
    -> Box<Future<Item = (), Error = Error>>
# { unimplemented!() } /*
{ ... }
# */

/// Do a full HTTP get to a remote URL
fn http_get(uri: &str)
    -> Box<Future<Item = String, Error = Error>>
# { unimplemented!() } /*
{ ... }
# */
#
# let my_executor = MyExecutor;

fn fetch_and_cache(url: &str)
    -> Box<Future<Item = String, Error = Error>>
{
    // The URL has to be converted to a string so that it can be
    // moved into the closure. Given futures are asynchronous,
    // the stack is not around anymore by the time the closure is called.
    let url = url.to_string();

    let response = http_get(&url)
        .and_then(move |response| {
            cache_put(&url, response.clone())
                .map(|_| response)
        });

    Box::new(response)
}

let url = "https://example.com";

let response = cache_get(url)
  .and_then(|resp| {
      // `Either` is a utility provided by the `futures` crate
      // that enables returning different futures from a single
      // closure without boxing.
      match resp {
          Some(resp) => Either::A(future::ok(resp)),
          None => {
              Either::B(fetch_and_cache(url))
          }
      }
  });

// Only let the task run for up to 20 seconds.
//
// This uses a fictional timer API. Use the `tokio-timer` crate for
// all your actual timer needs.
let task = Timeout::new(response, Duration::from_secs(20));

my_executor.spawn(task);
# }
# fn main() {}
```

Because the steps are all necessary for the task to complete, it makes sense to
group them all within the same task.

However, if instead of updating the cache on a cache-miss, we wanted to update
the cache value on an interval, then it would make sense to split that into
multiple tasks as the steps are no longer directly related.

```rust
# #![deny(deprecated)]
# extern crate futures;
# use futures::prelude::*;
# use futures::future::{self, Either};
# use std::time::Duration;
# fn docx() {
#
# pub struct Timeout;
# impl Timeout {
#     pub fn new<T>(_: T, _: Duration) -> Box<Future<Item = (), Error = ()>> {
#         unimplemented!();
#     }
# }
# pub struct Interval;
# impl Interval {
#     pub fn new(_: Duration) -> Box<Stream<Item = (), Error = Error>> {
#         unimplemented!();
#     }
# }
# pub struct MyExecutor;
# impl MyExecutor {
#     fn spawn<T>(&self, _: T) {
#         unimplemented!();
#     }
# }
# pub struct Error;
#
# fn cache_get(uri: &str)
#     -> Box<Future<Item = Option<String>, Error = Error>>
# { unimplemented!() }
# fn cache_put(uri: &str, val: String)
#     -> Box<Future<Item = (), Error = Error>>
# { unimplemented!() }
# fn http_get(uri: &str)
#     -> Box<Future<Item = String, Error = Error>>
# { unimplemented!() }
# fn fetch_and_cache(url: &str)
#     -> Box<Future<Item = String, Error = Error>>
# { unimplemented!() }
# let my_executor = MyExecutor;

let url = "https://example.com";

// An Interval is a stream that yields `()` on a fixed interval.
let update_cache = Interval::new(Duration::from_secs(60))
    // On each tick of the interval, update the cache. This is done
    // by using the same function from the previous snippet.
    .for_each(|_| {
        fetch_and_cache(url)
            .map(|resp| println!("updated cache with {}", resp))
    });

// Spawn the cache update task so that it runs in the background
my_executor.spawn(update_cache);

// Now, only get from the cache.
let response = cache_get(url);
let task = Timeout::new(response, Duration::from_secs(20));

my_executor.spawn(task);
# }
# fn main() {}
```

## [Message Passing](#message-passing) {#message-passing}

Just as with Go and Erlang, tasks can communicate using message passing. In
fact, it will be very common to use message passing to coordinate multiple
tasks. This allows independent tasks to still interact.

The [`futures`] crate provides a [`sync`] module which contains some channel
types that are ideal for message passing across tasks.

* [`oneshot`] is a channel for sending exactly one value.
* [`mpsc`] is a channel for sending many (zero or more) values.

The previous example isn't exactly correct. Given that tasks are executed
concurrently, there is no guarantee that the cache updating task will have
written the first value to the cache by the time the other task tries to read
from the cache.

This is a perfect situation to use message passing. The cache updating task can
send a message notifying the other task that it has primed the cache with an
initial value.

```rust
# #![deny(deprecated)]
# extern crate futures;
# use futures::prelude::*;
# use futures::future::{self, Either};
# use futures::sync::oneshot;
# use std::time::Duration;
# fn docx() {
#
# pub struct Timeout;
# impl Timeout {
#     pub fn new<T>(_: T, _: Duration) -> Box<Future<Item = (), Error = ()>> {
#         unimplemented!();
#     }
# }
# pub struct Interval;
# impl Interval {
#     pub fn new(_: Duration) -> Box<Stream<Item = (), Error = Error>> {
#         unimplemented!();
#     }
# }
# pub struct MyExecutor;
# impl MyExecutor {
#     fn spawn<T>(&self, _: T) {
#         unimplemented!();
#     }
# }
# pub struct Error;
#
# fn cache_get(uri: &str)
#     -> Box<Future<Item = Option<String>, Error = Error>>
# { unimplemented!() }
# fn cache_put(uri: &str, val: String)
#     -> Box<Future<Item = (), Error = Error>>
# { unimplemented!() }
# fn http_get(uri: &str)
#     -> Box<Future<Item = String, Error = Error>>
# { unimplemented!() }
# fn fetch_and_cache(url: &str)
#     -> Box<Future<Item = String, Error = Error>>
# { unimplemented!() }
# let my_executor = MyExecutor;

let url = "https://example.com";

let (primed_tx, primed_rx) = oneshot::channel();

let update_cache = fetch_and_cache(url)
    // Now, notify the other task that the cache is primed
    .then(|_| primed_tx.send(()))
    // Then we can start refreshing the cache on an interval
    .then(|_| {
        Interval::new(Duration::from_secs(60))
            .for_each(|_| {
                fetch_and_cache(url)
                    .map(|resp| println!("updated cache with {}", resp))
            })
    });

// Spawn the cache update task so that it runs in the background
my_executor.spawn(update_cache);

// First, wait for the cache to primed
let response = primed_rx
    .then(|_| cache_get(url));

let task = Timeout::new(response, Duration::from_secs(20));

my_executor.spawn(task);
# }
# fn main() {}
```

## [Task Notification](#task-notification) {#task-notification}

An application built with Tokio is structured as a set of concurrently running
tasks. Here is the basic structure of a server:

```rust
# #![deny(deprecated)]
# extern crate tokio;
#
# use tokio::io;
# use tokio::net::{TcpListener, TcpStream};
# use tokio::prelude::*;
#
# pub fn process(socket: TcpStream) -> Box<Future<Item = (), Error = ()> + Send> {
# unimplemented!();
# }
#
# fn docx() {
#     let addr = "127.0.0.1:6142".parse().unwrap();
#     let listener = TcpListener::bind(&addr).unwrap();
let server = listener.incoming().for_each(|socket| {
    // Spawn a task to process the connection
    tokio::spawn(process(socket));

    Ok(())
})
.map_err(|_| ()); // Just drop the error

tokio::run(server);
# }
# pub fn main() {}
```

In this case, we spawn a task for each inbound server socket. However, it is
also possible to implement a server future that processes all inbound
connections on the same socket:

```rust
# #![deny(deprecated)]
# extern crate futures;
# extern crate tokio;
# use futures::prelude::*;
# use tokio::net::*;
# use std::io;
pub struct Server {
    listener: TcpListener,
    connections: Vec<Box<Future<Item = (), Error = io::Error> + Send>>,
}
# pub fn process(socket: TcpStream) -> Box<Future<Item = (), Error = io::Error> + Send> {
# unimplemented!();
# }

impl Future for Server {
    type Item = ();
    type Error = io::Error;

    fn poll(&mut self) -> Result<Async<()>, io::Error> {
        // First, accept all new connections
        loop {
            match self.listener.poll_accept()? {
                Async::Ready((socket, _)) => {
                    let connection = process(socket);
                    self.connections.push(connection);
                }
                Async::NotReady => break,
            }
        }

        // Now, poll all connection futures.
        let len = self.connections.len();

        for i in (0..len).rev() {
            match self.connections[i].poll()? {
                Async::Ready(_) => {
                    self.connections.remove(i);
                }
                Async::NotReady => {}
            }
        }

        // `NotReady` is returned here because the future never actually
        // completes. The server runs until it is dropped.
        Ok(Async::NotReady)
    }
}
# pub fn main() {}
```

These two strategies are functionally equivalent, but have significantly
different runtime characteristics.

Notifications happens at the task level. The task does not know which
sub future triggered the notification. So, whenever the task is polled, it has
to try polling all sub futures.

{{< figure src="/img/diagrams/task-layout.png"
caption="Layout of a task" >}}

In this task, there are three sub futures that can get polled. If a resource
contained by one of the sub futures transitions to "ready", the task itself gets
notified and it will try to poll all three of its sub futures. One of them will
advance, which in turn advances the internal state of the task.

The key is to try to keep tasks small, doing as little as possible per task.
This is why servers spawn new tasks for each connection instead of processing
the connections in the same task as the listener.

Ok, there actually is a way for the task to know which sub future triggered the
notification using [`FuturesUnordered`], but usually the right thing to do is to
spawn a new task.

[Go's goroutine]: https://www.golang-book.com/books/intro/10
[Erlang's process]: http://erlang.org/doc/reference_manual/processes.html
[`Future`]: {{< api-url "futures" >}}/future/trait.Future.html
[executors]: #
[`futures`]: {{< api-url "futures" >}}
[`tokio`]: {{< api-url "tokio" >}}
[`sync`]: {{< api-url "futures" >}}/sync/index.html
[`oneshot`]: {{< api-url "futures" >}}/sync/oneshot/index.html
[`mpsc`]: {{< api-url "futures" >}}/sync/mpsc/index.html
[`FuturesUnordered`]: {{< api-url "futures" >}}/stream/futures_unordered/struct.FuturesUnordered.html
