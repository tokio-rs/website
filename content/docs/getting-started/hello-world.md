---
title: "Hello World!"
weight : 1010
menu:
  docs:
    parent: getting_started
---

To kick off our tour of Tokio, we will start with the obligatory "hello world"
example. This program will create a file and write "hello, world!" to the file.
The difference between this and a Rust program that writes to a file without Tokio
is that this program won't block program execution when the file is created or when
our "hello, world!" message is written to the file.

Let's get started.

First, generate a new crate.

```bash
$ cargo new --bin hello-world
$ cd hello-world
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

use tokio::io;
use tokio::fs::File;
use tokio::prelude::*;
# fn main() {}
```

# Creating the file

The first step is to create the `File`. We use the `File` implementation provided by Tokio.

```rust
# #![deny(deprecated)]
# extern crate tokio;
#
# use tokio::fs::File;
fn main() {
    let file = File::create("hello.txt");

    // Following snippets come here...
}
```

Next, we define the `hello_world` task. This asynchronous task will create the file
and then yield the file once it's been created for additional processing.

```rust
# #![deny(deprecated)]
# extern crate tokio;
#
# use tokio::io;
# use tokio::fs::File;
# use tokio::prelude::*;
# fn main() {
let hello_world = File::create("hello.txt").and_then(|file| {
    println!("created file");

    // Process file here.

    Ok(())
})
.map_err(|err| {
    // All tasks must have an `Error` type of `()`. This forces error
    // handling and helps avoid silencing failures.
    //
    // In our example, we are only going to log the error to STDOUT.
    println!("creation error = {:?}", err);
});
# }
```

The call to `File::create` returns a [`Future`] of the created file.
We'll learn more about [`Futures`] later in the guide, but for now you can think of
a [`Future`] as a value that represents something that will eventually happen in the
future (in this case the file will be created). This means that `File::create` does
not wait for the file to be created before it returns. Rather it returns immediately
with a value representing the work of creating a file. We'll see down below when this work
_actually_ gets executed.

The `and_then` method yields the file once it has been created. `and_then` is an
example of a combinator function that defines how asynchronous work will be processed.

Each combinator function takes ownership of necessary state as well as the
callback to perform and returns a new `Future` that has the additional "step"
sequenced. A `Future` is a value representing some computation that will complete at
some point in the future

It's worth reiterating that returned futures are lazy, i.e., no work is performed when
calling the combinator. Instead, once all the asynchronous steps are sequenced, the
final `Future` (representing the entire task) is "spawned" (i.e., run). This is when
the work that was previously defined starts getting run. In other words, the code
we've written so far does not actually create a file.

We will be digging more into futures (and the related concepts of streams and sinks)
later on.

It's also important to note that we've called `map_err` to convert whatever error
we may have gotten to `()` before we can actually run our future. This ensures that
we acknowledge errors.

Next, we will process the file.

# Writing data

Our goal is to write `"hello world\n"` to the file.

Going back to the `File::create().and_then` block:

```rust
# #![deny(deprecated)]
# extern crate tokio;
#
# use tokio::io;
# use tokio::fs::File;
# fn main() {
let hello_world = File::create("hello.txt").and_then(|file| {
    println!("created file");

    io::write_all(file, "hello world\n").then(|result| {
      println!("wrote to file; success={:?}", result.is_ok());
      Ok(())
    });
})
# ;
# }
```

The [`io::write_all`] function takes ownership of `file`, returning a
[`Future`] that completes once the entire message has been written to the
file. `then` is used to sequence a step that gets run once the write has
completed. In our example, we just write a message to `STDOUT` indicating that
the write has completed.

Note that `result` is a `Result` that contains the original file. This allows us
to sequence additional reads or writes to the same file. However, we have
nothing more to do, so we just drop the file, which automatically closes it.

# Running the hello_world task

So far we have a `Future` representing the work to be done by our program, but we
have not actually run it. We need a way to "spawn" that work. We need an executor.

Executors are responsible for scheduling asynchronous tasks, driving them to
completion. There are a number of executor implementations to choose from, each have
different pros and cons. In this example, we will use the default executor of the
[Tokio runtime][rt].

```rust
# #![deny(deprecated)]
# extern crate tokio;
# extern crate futures;
#
# use tokio::prelude::*;
# use futures::future;
# fn main() {
# let hello_world = future::ok(());

println!("About to create the file...");
tokio::run(hello_world);
println!("File has been created.");
# }
```

`tokio::run` starts the runtime, blocking the current thread until all spawned tasks
have completed and all resources (like files) have been dropped.

So far, we only have a single task running on the executor, so the `hello_world` task
is the only one blocking `run` from returning. Once `run` has returned we can be sure
that our Future has been run to completion.

You can find the full example [here][full-code].

# Next steps

We've only dipped our toes into Tokio and its asynchronous model. The next page in
the guide, will start digging deeper into the Tokio runtime model.

[`Future`]: {{< api-url "futures" >}}/future/trait.Future.html
[rt]: {{< api-url "tokio" >}}/runtime/index.html
[`io::write_all`]: {{< api-url "tokio-io" >}}/io/fn.write_all.html
[full-code]:https://github.com/tokio-rs/tokio/blob/master/examples/hello_world.rs
