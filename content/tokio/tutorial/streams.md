---
title: "Streams"
---

A stream is an asynchronous series of values. It is the asynchronous equivalent
to Rust's [`std::iter::Iterator`][iter] and is represented by the [`Stream`]
trait. Streams can be iterated in `async` functions. They can also be
transformed using adapters. Tokio provides a number of common adaptors on the
[`StreamExt`] trait.

Tokio provides stream support under the `stream` feature flag. When depending on
Tokio, include either `stream` or `full` to get access to this functionality.

```toml
tokio = { version = "0.2", features = ["stream"] }
```

A number of types we've already seen also implement [`Stream`]. For example, the
receive half of a [`mpsc::Receiver`][rx] implements [`Stream`]. The
[`AsyncBufReadExt::lines()`] method takes a buffered I/O reader and returns a
[`Stream`] where each value represents a line of data.

# Iteration

Currently, the Rust programming language does not support async `for` loops.
Instead, iterating streams is done using a `while let` loop paired with
[`StreamExt::next()`][next].

```rust
use tokio::stream::StreamExt;
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (mut tx, mut rx) = mpsc::channel(10);

    tokio::spawn(async move {
        tx.send(1).await.unwrap();
        tx.send(2).await.unwrap();
        tx.send(3).await.unwrap();
    });

    while let Some(v) = rx.next().await {
        println!("GOT = {:?}", v);
    }
}
```

Like iterators, the `next()` method returns `Option<T>` where `T` is the
stream's value type. Receiving `None` indicates that stream iteration is
terminated.

## Mini-Redis broadcast

Let's go over a slightly more complicated example using the Mini-Redis client.

Full code can be found [here][full].

[full]: https://github.com/tokio-rs/website/blob/master/tutorial-code/streams/src/main.rs

```rust
use tokio::stream::StreamExt;
use mini_redis::client;

async fn publish() -> mini_redis::Result<()> {
    let mut client = client::connect("127.0.0.1:6379").await?;

    // Publish some data
    client.publish("numbers", "1".into()).await?;
    client.publish("numbers", "two".into()).await?;
    client.publish("numbers", "3".into()).await?;
    client.publish("numbers", "four".into()).await?;
    client.publish("numbers", "five".into()).await?;
    client.publish("numbers", "6".into()).await?;
    Ok(())
}

async fn subscribe() -> mini_redis::Result<()> {
    let client = client::connect("127.0.0.1:6379").await?;
    let subscriber = client.subscribe(vec!["numbers".to_string()]).await?;
    let messages = subscriber.into_stream();

    tokio::pin!(messages);

    while let Some(msg) = messages.next().await {
        println!("got = {:?}", msg);
    }

    Ok(())
}

# fn dox() {
#[tokio::main]
async fn main() -> mini_redis::Result<()> {
    tokio::spawn(async {
        publish().await
    });

    subscribe().await?;

    println!("DONE");

    Ok(())
}
# }
```

A task is spawned to publish messages to the Mini-Redis server on the "numbers"
channel. Then, on the main task, we subscribe to the "numbers" channel and
display received messages.

After subscribing, [`into_stream()`] is called on the returned subscriber. This
consumes the `Subscriber`, returning a stream that yields messages as they
arrive. Before we start iterating the messages, note that the stream is
[pinned][pin] to the stack using [`tokio::pin!`]. Calling `next()` on a stream
requires the stream to be [pinned][pin]. The `into_stream()` function returns a
stream that is *not* pin, we must explicitly pin it in order to iterate it.

[[info]]
| A Rust value is "pinned" when it can no longer be moved in memory. A key
| property of a pinned value is that pointers can be taken to the pinned
| data and the caller can be confident the pointer stays valid. This feature
| is used by `async/await` to support borrowing data across `.await` points.

If we forget to pin the stream, we get an error like this:

```text
error[E0277]: `std::future::from_generator::GenFuture<[static generator@mini_redis::client::Subscriber::into_stream::{{closure}}#0 0:mini_redis::client::Subscriber, 1:async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 'static)>>> for<'r, 's, 't0, 't1, 't2, 't3, 't4, 't5, 't6> {std::future::ResumeTy, &'r mut mini_redis::client::Subscriber, mini_redis::client::Subscriber, impl std::future::Future, (), std::result::Result<std::option::Option<mini_redis::client::Message>, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't0)>>, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't1)>, &'t2 mut async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't3)>>>, async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't4)>>>, std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't5)>>, impl std::future::Future, std::option::Option<mini_redis::client::Message>, mini_redis::client::Message}]>` cannot be unpinned
   --> streams/src/main.rs:22:36
    |
22  |     while let Some(msg) = messages.next().await {
    |                                    ^^^^ within `impl futures_core::stream::Stream`, the trait `std::marker::Unpin` is not implemented for `std::future::from_generator::GenFuture<[static generator@mini_redis::client::Subscriber::into_stream::{{closure}}#0 0:mini_redis::client::Subscriber, 1:async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 'static)>>> for<'r, 's, 't0, 't1, 't2, 't3, 't4, 't5, 't6> {std::future::ResumeTy, &'r mut mini_redis::client::Subscriber, mini_redis::client::Subscriber, impl std::future::Future, (), std::result::Result<std::option::Option<mini_redis::client::Message>, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't0)>>, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't1)>, &'t2 mut async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't3)>>>, async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't4)>>>, std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't5)>>, impl std::future::Future, std::option::Option<mini_redis::client::Message>, mini_redis::client::Message}]>`
    | 
   ::: /home/carllerche/.cargo/registry/src/github.com-1ecc6299db9ec823/mini-redis-0.2.0/src/client.rs:398:37
    |
398 |     pub fn into_stream(mut self) -> impl Stream<Item = crate::Result<Message>> {
    |                                     ------------------------------------------ within this `impl futures_core::stream::Stream`
    |
    = note: required because it appears within the type `impl std::future::Future`
    = note: required because it appears within the type `async_stream::async_stream::AsyncStream<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 'static)>>, impl std::future::Future>`
    = note: required because it appears within the type `impl futures_core::stream::Stream`

error[E0277]: `std::future::from_generator::GenFuture<[static generator@mini_redis::client::Subscriber::into_stream::{{closure}}#0 0:mini_redis::client::Subscriber, 1:async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 'static)>>> for<'r, 's, 't0, 't1, 't2, 't3, 't4, 't5, 't6> {std::future::ResumeTy, &'r mut mini_redis::client::Subscriber, mini_redis::client::Subscriber, impl std::future::Future, (), std::result::Result<std::option::Option<mini_redis::client::Message>, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't0)>>, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't1)>, &'t2 mut async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't3)>>>, async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't4)>>>, std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't5)>>, impl std::future::Future, std::option::Option<mini_redis::client::Message>, mini_redis::client::Message}]>` cannot be unpinned
   --> streams/src/main.rs:22:27
    |
22  |     while let Some(msg) = messages.next().await {
    |                           ^^^^^^^^^^^^^^^^^^^^^ within `impl futures_core::stream::Stream`, the trait `std::marker::Unpin` is not implemented for `std::future::from_generator::GenFuture<[static generator@mini_redis::client::Subscriber::into_stream::{{closure}}#0 0:mini_redis::client::Subscriber, 1:async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 'static)>>> for<'r, 's, 't0, 't1, 't2, 't3, 't4, 't5, 't6> {std::future::ResumeTy, &'r mut mini_redis::client::Subscriber, mini_redis::client::Subscriber, impl std::future::Future, (), std::result::Result<std::option::Option<mini_redis::client::Message>, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't0)>>, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't1)>, &'t2 mut async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't3)>>>, async_stream::yielder::Sender<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't4)>>>, std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 't5)>>, impl std::future::Future, std::option::Option<mini_redis::client::Message>, mini_redis::client::Message}]>`
    | 
   ::: /home/carllerche/.cargo/registry/src/github.com-1ecc6299db9ec823/mini-redis-0.2.0/src/client.rs:398:37
    |
398 |     pub fn into_stream(mut self) -> impl Stream<Item = crate::Result<Message>> {
    |                                     ------------------------------------------ within this `impl futures_core::stream::Stream`
    |
    = note: required because it appears within the type `impl std::future::Future`
    = note: required because it appears within the type `async_stream::async_stream::AsyncStream<std::result::Result<mini_redis::client::Message, std::boxed::Box<(dyn std::error::Error + std::marker::Send + std::marker::Sync + 'static)>>, impl std::future::Future>`
    = note: required because it appears within the type `impl futures_core::stream::Stream`
    = note: required because of the requirements on the impl of `std::future::Future` for `tokio::stream::next::Next<'_, impl futures_core::stream::Stream>`

error: aborting due to 2 previous errors

For more information about this error, try `rustc --explain E0277`.
error: could not compile `streams`.

To learn more, run the command again with --verbose.
```

If you hit an error message like this, try pinning the value!

Before trying to run this, start the Mini-Redis server:

```text
$ mini-redis-server
```

Then try running the code. We will see the messages outputted to STDOUT.

```text
got = Ok(Message { channel: "numbers", content: b"1" })
got = Ok(Message { channel: "numbers", content: b"two" })
got = Ok(Message { channel: "numbers", content: b"3" })
got = Ok(Message { channel: "numbers", content: b"four" })
got = Ok(Message { channel: "numbers", content: b"five" })
got = Ok(Message { channel: "numbers", content: b"6" })
```

Some early messages may be dropped as there is a race between subscribing and
publishing. The program never exits. A subscription to a Mini-Redis channel
stays active as long as the server is active.

Let's see how we can work with streams to expand on this program.

# Adapters

Functions that take a [`Stream`] and return another [`Stream`] are often called
'stream adapters', as they're a form of the 'adapter pattern'. Common stream
adaptors include [`map`], [`take`], and [`filter`].

Lets update the Mini-Redis so that it will exit. After receiving three messages,
stop iterating messages. This is done using [`take`]. This adaptor limits the
stream to yield at **most** `n` messages.

```rust
# use mini_redis::client;
# use tokio::stream::StreamExt;
# async fn subscribe() -> mini_redis::Result<()> {
#    let client = client::connect("127.0.0.1:6379").await?;
#    let subscriber = client.subscribe(vec!["numbers".to_string()]).await?;
let messages = subscriber
    .into_stream()
    .take(3);
#     Ok(())
# }
```

Running the program again, we get:

```text
got = Ok(Message { channel: "numbers", content: b"1" })
got = Ok(Message { channel: "numbers", content: b"two" })
got = Ok(Message { channel: "numbers", content: b"3" })
```

This time the program ends.

Now, let's limit the stream to single digit numbers. We will check this by
checking for the message length. We use the [`filter`] adaptor to drop any
message that does not match the predicate.

```rust
# use mini_redis::client;
# use tokio::stream::StreamExt;
# async fn subscribe() -> mini_redis::Result<()> {
#    let client = client::connect("127.0.0.1:6379").await?;
#    let subscriber = client.subscribe(vec!["numbers".to_string()]).await?;
let messages = subscriber
    .into_stream()
    .filter(|msg| match msg {
        Ok(msg) if msg.content.len() == 1 => true,
        _ => false,
    })
    .take(3);
#     Ok(())
# }
```

Running the program again, we get:

```text
got = Ok(Message { channel: "numbers", content: b"1" })
got = Ok(Message { channel: "numbers", content: b"3" })
got = Ok(Message { channel: "numbers", content: b"6" })
```

Note that the order in which adaptors are applied matters. Calling `filter`
first then `take` is different than calling `take` then `filter`.

Finally, we will tidy up the output by stripping the `Ok(Message { ... })` part
of the output. This is done with [`map`]. Because this is applied **after**
`filter`, we know the message is `Ok`, so we can use `unwrap()`.

```rust
# use mini_redis::client;
# use tokio::stream::StreamExt;
# async fn subscribe() -> mini_redis::Result<()> {
#    let client = client::connect("127.0.0.1:6379").await?;
#    let subscriber = client.subscribe(vec!["numbers".to_string()]).await?;
let messages = subscriber
    .into_stream()
    .filter(|msg| match msg {
        Ok(msg) if msg.content.len() == 1 => true,
        _ => false,
    })
    .map(|msg| msg.unwrap().content)
    .take(3);
#     Ok(())
# }
```

Now, the output is:

```text
got = b"1"
got = b"3"
got = b"6"
```

Another option would be to combine the [`filter`] and [`map`] steps into a single call using [`filter_map`].

There are more available adapters. See the list [here][`StreamExt`].

# Implementing `Stream`

The [`Stream`] trait is very similar to the [`Future`] trait.

```rust
use std::pin::Pin;
use std::task::{Context, Poll};

pub trait Stream {
    type Item;

    fn poll_next(
        self: Pin<&mut Self>, 
        cx: &mut Context<'_>
    ) -> Poll<Option<Self::Item>>;

    fn size_hint(&self) -> (usize, Option<usize>) {
        (0, None)
    }
}
```

The `Stream::poll_next()` function is much like `Future::poll`, except it can be called
repeatedly to receive many values from the stream. Just as we saw in [Async in
depth][async], when a stream is **not** ready to return a value, `Poll::Pending`
is returned instead. The task's waker is registered. Once the stream should be
polled again, the waker is notified.

The `size_hint()` method is used the same way as it is with [iterators][iter].

Usually, when manually implementing a `Stream`, it is done by composing futures
and other streams. As an example, let's build off of the `Delay` future we
implemented in [Async in depth][async]. We will convert it to a stream that
yields `()` three times at 10 ms intervals

```
use tokio::stream::Stream;
# use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Duration;
# use std::time::Instant;

struct Interval {
    rem: usize,
    delay: Delay,
}
# struct Delay { when: Instant }
# impl Future for Delay {
#   type Output = ();
#   fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<()> {
#       Poll::Pending
#   }  
# }

impl Stream for Interval {
    type Item = ();

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>)
        -> Poll<Option<()>>
    {
        if self.rem == 0 {
            // No more delays
            return Poll::Ready(None);
        }

        match Pin::new(&mut self.delay).poll(cx) {
            Poll::Ready(_) => {
                let when = self.delay.when + Duration::from_millis(10);
                self.delay = Delay {when };
                Poll::Ready(Some(()))
            }
            Poll::Pending => Poll::Pending,
        }
    }
}
```

## `async-stream`

Manually implementing streams using the [`Stream`] trait can be tedious.
Unfortunately, the Rust programming language does not yet support `async/await`
syntax for defining streams. This is in the works, but not yet ready.

The [`async-stream`] crate is available as a temporary solution. This crate
provides an `async_stream!` macro that transforms the input into a stream. Using
this crate, the above interval can be implemented like this:

```rust
use async_stream::stream;
# use std::future::Future;
# use std::pin::Pin;
# use std::task::{Context, Poll};
# use tokio::stream::StreamExt;
use std::time::{Duration, Instant};

# struct Delay { when: Instant }
# impl Future for Delay {
#   type Output = ();
#   fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<()> {
#       Poll::Pending
#   }
# }
# async fn dox() {
# let stream =
stream! {
    let mut when = Instant::now();
    for _ in 0..3 {
        let delay = Delay { when };
        delay.await;
        yield ();
        when += Duration::from_millis(10);
    }
}
# ;
# tokio::pin!(stream);
# while let Some(_) = stream.next().await { }
# }
```

[iter]: https://doc.rust-lang.org/book/ch13-02-iterators.html
[`Stream`]: https://docs.rs/tokio/0.2/tokio/stream/trait.Stream.html
[`Future`]: https://doc.rust-lang.org/std/future/trait.Future.html
[`StreamExt`]: https://docs.rs/tokio/0.2/tokio/stream/trait.StreamExt.html
[rx]: https://docs.rs/tokio/0.2/tokio/sync/mpsc/struct.Receiver.html
[`AsyncBufReadExt::lines()`]: https://docs.rs/tokio/0.2/tokio/io/trait.AsyncBufReadExt.html#method.lines
[next]: https://docs.rs/tokio/0.2/tokio/stream/trait.StreamExt.html#method.next
[`map`]: https://docs.rs/tokio/0.2/tokio/stream/trait.StreamExt.html#method.map
[`take`]: https://docs.rs/tokio/0.2/tokio/stream/trait.StreamExt.html#method.take
[`filter`]: https://docs.rs/tokio/0.2/tokio/stream/trait.StreamExt.html#method.filter
[`filter_map`]: https://docs.rs/tokio/0.2/tokio/stream/trait.StreamExt.html#method.filter_map
[pin]: https://doc.rust-lang.org/std/pin/index.html
[async]: async
[`async-stream`]: https://docs.rs/async-stream
[`into_stream()`]: https://docs.rs/mini-redis/0.2/mini_redis/client/struct.Subscriber.html#method.into_stream
[`tokio::pin!`]: https://docs.rs/tokio/0.2/tokio/macro.pin.html