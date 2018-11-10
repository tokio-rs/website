---
title: "Runtime model"
weight : 2080
menu:
  docs:
    parent: futures
    identifier: "futures_runtime_model"
---

Streams are similar to futures, but instead of yielding a single value, they
asynchronously yield one or more values. They can be thought of as asynchronous
iterators.

Just like futures, streams are able to represent a wide range of things as long
as those things produce discrete values at different points sometime in the
future. For instance:

* **UI Events** caused by the user interacting with a GUI in different ways. When an
  event happens the stream yields a different message to your app over time.
* **Push Notifications from a server**. Sometimes a request/response model is not
  what you need. A client can establish a notification stream with a server to be
  able to receive messages from the server without specifically being requested.
* **Incoming socket connections**. As different clients connect to a server, the
  connections stream will yield socket connections.

# The `Stream` trait

Just like `Future`, implementing `Stream` is common when using Tokio. Streams
yield many values, so lets start with a stream that generates the fibonacci sequence.

The `Stream` trait is as follows:

```rust,ignore
trait Stream {
    /// The type of the value yielded by the stream.
    type Item;

    /// The type representing errors that occurred while processing the computation.
    type Error;

    /// The function that will be repeatedly called to see if the stream has
    /// another value it can yield
    fn poll(&mut self) -> Poll<Option<Self::Item>, Self::Error>;
}
```

The `Item` associated type is the type yielded by the stream. The `Error`
associated type is the type of the error yielded when something unexpected
happens. The `poll` function is very similar to `Future`'s `poll` function. The
only difference is that, this time, `Option<Self::Item>` is returned.

Stream implementations have the `poll` function called many times. When the next
value is ready, `Ok(Async::Ready(Some(value)))` is returned. When the stream is
**not ready** to yield a value, `Ok(Async::NotReady)` is returned. When the
stream is exhausted and will yield no further values, `Ok(Async::Ready(None))`
is returned.
