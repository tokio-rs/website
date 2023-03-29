---
title: "Graceful Shutdown"
---

The purpose of this page is to give an overview of how to properly implement
shutdown in asynchronous applications.

There are usually three parts to implementing graceful shutdown:

 * Figuring out when to shut down.
 * Telling every part of the program to shut down.
 * Waiting for other parts of the program to shut down.

The rest of this article will go through these parts. A real world
implementation of the approach described here can be found in [mini-redis],
specifically the [`src/server.rs`][server.rs] and
[`src/shutdown.rs`][shutdown.rs] files.

## Figuring out when to shut down

This will of course depend on the application, but one very common shutdown
criteria is when the application receives a signal from the operating system.
This happens e.g. when you press ctrl+c in the terminal while the program is
running. To detect this, Tokio provides a [`tokio::signal::ctrl_c`][ctrl_c]
function, which will sleep until such a signal is received. You might use it
like this:
```rs
use tokio::signal;

#[tokio::main]
async fn main() {
    // ... spawn application as separate task ...

    match signal::ctrl_c().await {
        Ok(()) => {},
        Err(err) => {
            eprintln!("Unable to listen for shutdown signal: {}", err);
            // we also shut down in case of error
        },
    }

    // send shutdown signal to application and wait
}
```
If you have multiple shutdown conditions, you can use [an mpsc channel] to send
the shutdown signal to one place. You can then [select] on [`ctrl_c`][ctrl_c]
and the channel. For example:
```rs
use tokio::signal;
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (shutdown_send, shutdown_recv) = mpsc::unbounded_channel();

    // ... spawn application as separate task ...
    //
    // application uses shutdown_send in case a shutdown was issued from inside
    // the application

    tokio::select! {
        _ = signal::ctrl_c() => {},
        _ = shutdown_recv.recv() => {},
    }

    // send shutdown signal to application and wait
}
```

## Telling things to shut down

When you want to tell one or more tasks to shut down, you can use [Cancellation 
Tokens][cancellation-tokens]. These tokens allow you to notify tasks that they 
should terminate themselves in response to a cancellation request, making it 
easy to implement graceful shutdowns.

To use Cancellation Tokens, you first create a new `CancellationToken`, then 
pass it to the tasks that should respond to cancellation requests. When you 
want to shut down these tasks gracefully, you call the `cancel` method on the 
token, and any task listening to the cancellation request will be notified 
to shut down.

```rs
// Step 1: Create a new CancellationToken
let token = CancellationToken::new();

// Task 1 - Wait for token cancellation or a long time
tokio::spawn(async move {
    tokio::select! {
        // Step 2: Listen to cancellation requests
        _ = token.cancelled() => {
            // The token was cancelled, task can shut down
        }
        _ = tokio::time::sleep(std::time::Duration::from_secs(9999)) => {
            // Long work has completed
        }
    }
});

// Task 2 - Cancel the token after a small delay 
tokio::spawn(async move {
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    // Step 3: Cancel the token to notify other tasks about shutting down gracefully
    token.cancel();
});
```

With Cancellation Tokens, you don't have to shut down a task immediately when 
the token is cancelled. Instead, you can run a shutdown procedure before 
terminating the task, such as flushing data to a file or database, or sending 
a shutdown message on a connection.

## Waiting for things to finish shutting down

Once you have told other tasks to shut down, you will need to wait for them to
finish. The easiest way to do this is to use [an mpsc channel] where, instead of
sending messages, you wait for the channel to be closed, which happens when
every sender has been dropped.

As a simple example of this pattern, the following example will spawn 10 tasks,
then use an mpsc channel to wait for them to shut down.
```rs
use tokio::sync::mpsc::{channel, Sender};
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let (send, mut recv) = channel(1);

    for i in 0..10 {
        tokio::spawn(some_operation(i, send.clone()));
    }

    // Wait for the tasks to finish.
    //
    // We drop our sender first because the recv() call otherwise
    // sleeps forever.
    drop(send);

    // When every sender has gone out of scope, the recv call
    // will return with an error. We ignore the error.
    let _ = recv.recv().await;
}

async fn some_operation(i: u64, _sender: Sender<()>) {
    sleep(Duration::from_millis(100 * i)).await;
    println!("Task {} shutting down.", i);

    // sender goes out of scope ...
}
```
A very important detail is that the task waiting for shutdown usually holds one
of the senders. When this is the case, you must make sure to drop that sender
before waiting for the channel to be closed.

[ctrl_c]: https://docs.rs/tokio/1/tokio/signal/fn.ctrl_c.html
[an mpsc channel]: https://docs.rs/tokio/1/tokio/sync/mpsc/index.html
[select]: https://docs.rs/tokio/1/tokio/macro.select.html
[cancellation-tokens]: https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html
[watch]: https://docs.rs/tokio/1/tokio/sync/watch/index.html
[shutdown.rs]: https://github.com/tokio-rs/mini-redis/blob/master/src/shutdown.rs
[server.rs]: https://github.com/tokio-rs/mini-redis/blob/master/src/server.rs
[mini-redis]: https://github.com/tokio-rs/mini-redis/
