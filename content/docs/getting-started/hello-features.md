---
title: "Tokio Features"
weight : 1020
menu:
  docs:
    parent: getting_started
---

Feel free to skip this section, and just use `features = ["full"]` while
learning. This section provides some examples of how and when to specify
tokio features. 

## Often using all features is fine 

When writing an app, we'll often use all of Tokio's features to accelerate
our development time:

```toml
[dependencies]
tokio = { version = "0.2", features = ["full"] }
```

For most apps, the additional compile time is hardly noticeable relative to the
cognitive overhead of thinking about which features are needed.

# Selecting features

When we develop protocol implementations that are used by client apps and
servers, we want to limit the dependencies to decrease compile time --
not just for us, but also for the users of our crates.

Let's take a look at our tiny client app and see what features are needed.

## tokio main

If we change our code, so that it only uses the `#[tokio::main]` macro:

```
#[tokio::main]
async fn main() {
    println!("doing nothing yet");
}
```

then we can choose whether to use threads (commonly used for servers):

```
tokio = { version = "0.2", features = ["macros", "rt-threaded"] }
```

or lightweight cooperative multi-tasking
(often required for low-profile clients): 

```
tokio = { version = "0.2", features = ["macros", "rt-core"] }
```

## TcpStream connect

As we start to build the app, we'll need more features.  The line of code
where we call `TcpStream::connect` requires two features: 


```
    let stream = TcpStream::connect("127.0.0.1:6142").await.unwrap();
```


1. `dns` for converting the string `127.0.0.1:6142` to an IP address -- Tokio 
will need to do a DNS lookup just in case.
2. `tcp` for handling the TCP connection


## Writing to the socket

Writing to the stream requires `io-util`:

```
    let result = stream.write(b"hello world\n").await;
```

## Learn more about features

The [`API reference`] includes annotations that indicate which features are
needed for different APIs.  Please [`open an issue`] for any missing info, and
the team will get it fixed up asap!


[`API reference`]: https://docs.rs/tokio/
[`open an issue`]: https://github.com/tokio-rs/tokio/issues/new