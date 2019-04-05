---
title: "Example: An Echo Server"
weight : 1040
menu:
  docs:
    parent: getting_started
---

We're going to use what has been covered so far to build an echo server. This is a
Tokio application that encorporates everything we've learned so far. The server will
simply receive messages from the connected client and send back the same message it
received to the client.

We'll be able to test this echo server using the basic Tcp client we created in the
[hello world] section.

The full code can be found [here][full-code].

# Setup

First, generate a new crate.

```shell
$ cargo new --bin echo-server
cd echo-server
```

Next, add the necessary dependencies:

```toml
[dependencies]
tokio = "0.1"
```

and the crates and types into scope in `main.rs`:

```rust
# #![deny(deprecated)]
extern crate tokio;
extern crate futures;

use tokio::io;
use tokio::net::TcpListener;
use tokio::prelude::*;

# fn main() {}
```

Now, we setup the necessary structure for a server:

* Bind a `TcpListener` to a local port.
* Define a task that accepts inbound connections and processes them.
* Spawn the server task.
* Start the Tokio runtime

Again, no work actually happens until the server task is spawned on the
executor.

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate futures;
#
# use tokio::prelude::*;
# use tokio::net::TcpListener;
fn main() {
    let addr = "127.0.0.1:6142".parse().unwrap();
    let listener = TcpListener::bind(&addr).unwrap();

    // Here we convert the `TcpListener` to a stream of incoming connections
    // with the `incoming` method. We then define how to process each element in
    // the stream with the `for_each` combinator method
    let server = listener.incoming().for_each(|socket| {
        // TODO: Process socket
        Ok(())
    })
    .map_err(|err| {
        // Handle error by printing to STDOUT.
        println!("accept error = {:?}", err);
    });

    println!("server running on localhost:6142");
#    // `select` completes when the first of the two futures completes. Since
#    // future::ok() completes immediately, the server won't hang waiting for
#    // more connections. This is just so the doc test doesn't hang.
#    let server = server.select(futures::future::ok(())).then(|_| Ok(()));

    // Start the server
    //
    // This does a few things:
    //
    // * Start the Tokio runtime
    // * Spawns the `server` task onto the runtime.
    // * Blocks the current thread until the runtime becomes idle, i.e. all
    //   spawned tasks have completed.
    tokio::run(server);
}
```

Here we've created a TcpListener that can listen for incoming TCP connections. On the
listener we call `incoming` which turns the listener into a `Stream` of inbound client
connections. We then call `for_each` which will yield each inbound client connection.
For now we're not doing anything with this inbound connection - that's our next step.

Once we have our server, we can give it to `tokio::run`. Up until this point our
server feature has done nothing. It's up to the Tokio runtime to drive our future to
completion.

Note: We must call `map_err` on our `server` future because `tokio::run` expects
a future with `Item` of type `()` and `Error` of type `()`. This is to ensure that
we handle all values and errors before handing off the future to the runtime.

## Handling the connections

Now that we have incoming client connections, we should handle them.

We just want to copy all data read from the socket back onto the socket itself
(e.g. "echo"). We can use the standard [`io::copy`] function to do precisely this.

The `copy` function takes two arguments, where to read from and where to write to.
We only have one argument, though, with `socket`. Luckily there's a method, [`split`]
, which will split a readable and writeable stream into its two halves. This
operation allows us to work with each stream independently, such as pass them as two
arguments to the `copy` function.

The `copy` function then returns a future, and this future will be resolved when the
copying operation is complete, resolving to the amount of data that was copied.

Let's take a look at the closure we passed to `for_each` again.

```rust, no_run
# #![deny(deprecated)]
# extern crate tokio;
# extern crate futures;
#
# use tokio::prelude::*;
# use tokio::net::TcpListener;
# use tokio::io;
# fn main() {
# let addr = "127.0.0.1:6142".parse().unwrap();
# let listener = TcpListener::bind(&addr).unwrap();
let server = listener.incoming().for_each(|socket| {
  // split the socket stream into readable and writable parts
  let (reader, writer) = socket.split();
  // copy bytes from the reader into the writer
  let amount = io::copy(reader, writer);

  let msg = amount.then(|result| {
    match result {
      Ok((amount, _, _)) => println!("wrote {} bytes", amount),
      Err(e)             => println!("error: {}", e),
    }

    Ok(())
  });

  // spawn the task that handles the client connection socket on to the
  // tokio runtime. This means each client connection will be handled
  // concurrently
  tokio::spawn(msg);
  Ok(())
})
# .map_err(|_| ());
# let server = server.select(futures::future::ok(())).then(|_| Ok(()));
# tokio::run(server);
# }
```

As you can see we've split the `socket` stream into readable and writable parts. We
then used `io::copy` to read from `reader` and write into `writer`. We use the `then`
combinator to look at the `amount` future's `Item` and `Error` as a `Result` printing
some diagnostics.

The call to [`tokio::spawn`] is the key here. We crucially want all clients to make
progress concurrently, rather than blocking one on completion of another. To achieve
this we use the `tokio::spawn` function to execute the work in the background.

If we did not do this then each invocation of the block in `for_each` would be
resolved at a time meaning we could never have two client connections processed
concurrently!

The full code can be found [here][full-code].

[full-code]: https://github.com/tokio-rs/tokio/blob/master/tokio/examples/echo.rs
[hello world]: {{< ref "/docs/getting-started/hello-world.md" >}}
[`io::copy`]: {{< api-url "tokio" >}}/io/fn.copy.html
[`split`]: {{< api-url "tokio" >}}/io/trait.AsyncRead.html#method.split
[`tokio::spawn`]: {{< api-url "tokio-executor" >}}/fn.spawn.html
