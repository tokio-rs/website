+++
title = "Futures"
description = "A productive, zero-cost approach to asynchrony"
menu = "getting_started"
weight = 102
+++

Tokio is fundamentally based on *asynchronous I/O*. While you don't need to have
a deep understanding of async I/O to use Tokio, it's good to have the basic picture.

Let's start with a simple piece of I/O you might want to perform: reading a
certain number of bytes from a socket. Rust's standard library provides a
function,
[`read_exact`](https://static.rust-lang.org/doc/master/std/io/trait.Read.html#method.read_exact),
to do this:

```rust,ignore
// reads 4096 bytes into `my_vec`
socket.read_exact(&mut my_vec[..4096]);
```

**Quick quiz**: what happens if the socket hasn't received 4096 bytes yet?

Since the standard library is based on *synchronous* I/O, the answer is that the
calling thread is blocked, sleeping until more bytes are available. While that
works well in some contexts, it can be a problem for scaling up servers: if we
want to serve a large number of clients concurrently, but each request might
involve blocking a thread, then we're going to need a large number of threads.

In the asynchronous world, instead of blocking until requests can be completed,
we register that we *want* to perform a certain request, and are later notified
when that request can be fulfilled. That means that we can use a single thread
to manage an arbitrary number of connections, with each connection using minimal
resources.

Somehow, though, we've got to manage all of those in-flight requests. It'd be
nice if we could write code in terms of individual connections and operations,
and have all of that tracking and dispatching taken care of for us.

That's where futures come in.

## [Futures](#futures) {#futures}

A future is a value that's in the process of being computed, but might not be
ready yet. Usually, the future becomes *complete* (the value is ready) due to an
event happening somewhere else. While we've been looking at things from the
perspective of basic I/O, you can use a future to represent a wide range of
events, e.g.:

- **A database query** that's executing in a thread pool. When the query finishes,
  the future is completed, and its value is the result of the query.

- **An RPC invocation** to a server. When the server replies, the future is
  completed, and its value is the server's response.

- **A timeout**. When time is up, the future is completed, and its value is
  `()`.

- **A long-running CPU-intensive task**, running on a thread pool. When the task
  finishes, the future is completed, and its value is the return value of the
  task.

- **Reading bytes from a socket**. When the bytes are ready, the future is completed
-- and depending on the buffering strategy, the bytes might be returned
directly, or written as a side-effect into some existing buffer.

In short, futures are applicable to asynchronous events of all shapes and
sizes. The asynchrony is reflected in the fact that you get a *future* right
away, without blocking, even though the *value* the future represents will
become ready only at some unknown time in the... future.

#### [A simple example](#simple-example) {#simple-example}

Let's make this concrete with an example: we'll take a long-running computation
and add a timeout to it using futures.

```shell
cargo new --bin prime-timeout
cd prime-timeout
```

Here we'll bring in futures and a couple additional tools on top:

```toml
[dependencies]
futures = "0.1"
futures-cpupool = "0.1"
tokio-timer = "0.1"
```

For our lengthy computation, we'll inefficiently confirm that a large prime
number is prime:

```rust
const BIG_PRIME: u64 = 15485867;

// checks whether a number is prime, slowly
fn is_prime(num: u64) -> bool {
    for i in 2..num {
        if num % i == 0 { return false }
    }
    true
}
```

##### [Synchronous version](#synchronous-version) {#synchronous-version}

Before we use futures, here's how we'd run this computation synchronously---we
just call the function:

```rust
# const BIG_PRIME: u64 = 1;
# fn is_prime(num: u64) -> bool { true }
// Synchronous version
fn main() {
    if is_prime(BIG_PRIME) {
        println!("Prime");
    } else {
        println!("Not prime");
    }
}
```

The effect is that the main thread is blocked until the computation finishes,
and then it prints out the result.

##### [Asynchronous version](#asynchronous-version) {#asynchronous-version}

Now let's use futures and a thread pool to launch the computation
asynchronously:

```rust
# #![deny(deprecated)]
extern crate futures;
extern crate futures_cpupool;

use futures::Future;
use futures_cpupool::CpuPool;

# const BIG_PRIME: u64 = 1;
# fn is_prime(num: u64) -> bool { true }

fn main() {
    // set up a thread pool
    let pool = CpuPool::new_num_cpus();

    // spawn our computation, getting back a *future* of the answer
    let prime_future = pool.spawn_fn(|| {
        let prime = is_prime(BIG_PRIME);

        // For reasons we'll see later, we need to return a Result here
        let res: Result<bool, ()> = Ok(prime);
        res
    });

    println!("Created the future");
}
```

This version of the code pushes work onto a thread pool, and *immediately*
returns a future, `prime_future`. Thus, we'll see `Created the future` on the
console right away, while the primality test is done in the background. Of
course, this isn't so useful---we've thrown away the answer!

Even though futures are asynchronous, you always have the option of treating
them synchronously, by *waiting* for completion:

```rust
# #![deny(warnings)]
# extern crate futures;
# fn main() {
# use futures::Future;
// ...

println!("Created the future");

// unwrap here since we know the result is Ok
# let prime_future = futures::future::ok::<bool, ()>(true);
if prime_future.wait().unwrap() {
    println!("Prime");
} else {
    println!("Not prime");
}
# }
```

While
[`wait`](https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.wait)
isn't very commonly used in practice, it's a nice illustration of the difference
between a future (like `prime_future`) and the value it produces; the future is
returned right away, allowing you to do additional work concurrently (like
printing a message, here), and retrieve the value later on.

##### [Adding a timeout](#adding-a-timeout) {#adding-a-timeout}

So far this example isn't terribly interesting, since there are simpler ways to
work with thread pools. But one strength of futures is their ability to
*combine*. We'll show this off by combining the thread pool future with a
timeout future:

```rust
# #![deny(deprecated)]
extern crate futures;
extern crate futures_cpupool;
extern crate tokio_timer;

use std::time::Duration;

use futures::Future;
use futures_cpupool::CpuPool;
use tokio_timer::Timer;

# const BIG_PRIME: u64 = 1;
# fn is_prime(num: u64) -> bool { true }

fn main() {
    let pool = CpuPool::new_num_cpus();
    let timer = Timer::default();

    // a future that resolves to Err after a timeout
    let timeout = timer.sleep(Duration::from_millis(750))
        .then(|_| Err(()));

    // a future that resolves to Ok with the primality result
    let prime = pool.spawn_fn(|| {
        Ok(is_prime(BIG_PRIME))
    });

    // a future that resolves to one of the above values -- whichever
    // completes first!
    let winner = timeout.select(prime).map(|(win, _)| win);

    // now block until we have a winner, then print what happened
    match winner.wait() {
        Ok(true) => println!("Prime"),
        Ok(false) => println!("Not prime"),
        Err(_) => println!("Timed out"),
    }
}
```

Here, we're using a couple of additional methods on futures:

- [`then`](https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.then),
  which in general allows you to sequence one future to run after getting the
  value of another. In this case, we're just using it to change the value
  returned from the timeout future to `Err(())`.

- [`select`](https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.select),
  which combines two futures of the same type, allowing them to "race" to
  completion. It yields a pair, where the first component is the value produced
  by the first future to complete, and the second gives you the other future
  back. Here, we just take the winning value.

While this example is simplistic, it gives some sense for how futures scale
up. Once you have a number of basic "events" set up as futures, you can combine
them in complex ways, and the futures library takes care of tracking all of the
relevant state and synchronization. For example here we're behind the scenes
managing concurrent execution of `is_prime` on a thread pool, the timer thread
managed by `Timer`, and the main thread calling `wait` all at once.

##### [Whence I/O?](#whence-io) {#whence-io}

We haven't shown how to work directly with I/O events as futures. That's because
I/O is a bit more complicated, and you often end up working with sibling
abstractions to futures: streams and sinks. These are all covered in subsequent
guides.

## [The `Future` trait](#the-future-trait) {#the-future-trait}

At this point, we've seen just a tiny bit of the futures API---but what actually
*is* a future?

In the `futures` library, a future is anything that implements the
[`Future` trait](https://docs.rs/futures/0.1/futures/future/trait.Future.html),
which has a lot of similarities to the
[`Iterator` trait](https://static.rust-lang.org/doc/master/std/iter/trait.Iterator.html)
in the standard library:

```rust,ignore
trait Future {
    // The type of value that the future yields on successful completion.
    type Item;

    // The type of value that the future yields on failure.
    type Error;

    // The only required method, which attempts to complete the future.
    fn poll(&mut self) -> Poll<Self::Item, Self::Error>;

    // Blocks until completion.
    fn wait(self) -> Result<Self::Item, Self::Error> { ... }

    // Transforms the result of the future using the given closure.
    fn map<F, U>(self, f: F) -> Map<Self, F>
        where F: FnOnce(Self::Item) -> U { ... }

    // ... and many, many more provided methods
}
```

Since futures are primarily motivated by I/O, error handling is an important
concern baked in to the trait and its methods.

The `poll` method is the heart of the futures trait---it's how futures actually
do their work. However, it's not generally called directly. Instead, you tend to
work through the other methods of the `Future` trait (which are all default
methods).  You can find an in-depth explanation of `poll` in [the futures model
in depth]({{< relref "futures-model.md" >}}).

So that's the quick tour. In the next section, we'll look at a more involved
example: hooking up a database to the [line-based protocol](../simple-server) we
developed earlier.
