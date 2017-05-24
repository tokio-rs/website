+++
title = "Example: serving database content using proto"
description = "Writing a `fortune` server using proto"
menu = "getting_started"
weight = 103
+++

In our previous example, an echo server, we didn't leverage the fact that a
future can be returned from a [`Service`]. Having just gotten our feet wet with
futures, however, let's take a look at an example where we do just that. Here
we'll be exploring a case in a well-known benchmark suite, [TechEmpower].
Specifically we'll be looking at the [second benchmark], which entails that we
perform a few tasks:

[TechEmpower]: https://github.com/TechEmpower/FrameworkBenchmarks
[second benchmark]: http://frameworkbenchmarks.readthedocs.io/en/latest/Project-Information/Framework-Tests/#single-database-query

1. Spin up an HTTP server, listening for HTTP requests to `/db`.
2. On each request, look up a random row in a database table.
3. Once the row is loaded, serialize it to JSON, and send it back.

Sounds easy enough, let's get started! If you'd like to [skip ahead to the
complete code listing](#complete) you can also do so.

First up let's discuss how we're going to design the general architecture of
our program. We'll primarily need an HTTP server and a database driver. For
this example we'll be using [`tokio-minihttp`], a proof-of-concept pipelined
and asynchronous HTTP/1.1 server. This crate is not production ready nor will
it ever be, but it's intended to show off an example of using [`tokio-proto`]
with a simple HTTP implementation to hit the ground running.

[`tokio-minihttp`]: https://github.com/tokio-rs/tokio-minihttp
[`tokio-proto`]: https://github.com/tokio-rs/tokio-proto

Next for our database driver we're going to be using the [`postgres`] crate on
[crates.io]. This driver is *synchronous* and will provide an excellent
opportunity to see how we bridge the synchronous and asynchronous worlds. We'll
be using a thread pool to execute the database queries themselves in addition
to pooling database connections with the [`r2d2`] crate from [crates.io]. Note
that ideally we'd use an asynchronous database driver to avoid the overhead of
a thread pool, but at this time this isn't available so we'll stick to thread
pools.

[`r2d2`]: https://github.com/sfackler/r2d2
[`postgres`]: https://github.com/sfackler/rust-postgres
[crates.io]: https://crates.io

With a general layout in mind, let's pull in our dependencies through
`Cargo.toml`'s `[dependencies]` section:

```toml
# basic dependencies from echo server before
futures = "0.1"
tokio-proto = "0.1"
tokio-service = "0.1"

# our toy HTTP implementation
tokio-minihttp = { git = "https://github.com/tokio-rs/tokio-minihttp" }

# database support with connection pooling
r2d2 = "0.7"
r2d2_postgres = "0.11"

# json
serde_derive = "1.0"
serde = "1.0"
serde_json = "1.0"

# misc support for thread pools, random numbers
futures-cpupool = "0.1"
rand = "0.3"
```

Next up, let's get through the boilerplate of setting up our server:

```rust,ignore
fn main() {
    let addr = "127.0.0.1:8080".parse().unwrap();
    let thread_pool = CpuPool::new(10);

    let db_url = "postgres://postgres@localhost";
    let db_config = r2d2::Config::default();
    let db_manager = PostgresConnectionManager::new(db_url, TlsMode::None).unwrap();
    let db_pool = r2d2::Pool::new(db_config, db_manager).unwrap();

    TcpServer::new(tokio_minihttp::Http, addr).serve(move || {
        // ...
    })
}
```

Here we're first creating a thread pool to execute blocking database queries in
and then we're creating a pool of database connections themselves, configured
with the [`r2d2`] crate and its associated [`postgres`] support. We're just
sticking to the defaults for now but you can tune these parameters if you'd
like locally.

Next up comes where we actually spin up our server:

```rust,ignore
TcpServer::new(tokio_minihttp::Http, addr).serve(move || {
    // ...
})
```

Here we're using [`TcpServer`] in the [`tokio-proto`] crate, and we're
specifying the [`Http`] protocol implementation in the [`tokio-minihttp`] crate.
Behind the scenes, this is going to create an event loop, configure it to accept
TCP connections, and then create a new service (with our closure) for each
connection. All connections will be handled by the [`Http`] protocol
implementation.

[`TcpServer`]: https://tokio-rs.github.io/tokio-proto/tokio_proto/struct.TcpServer.html
[`Http`]: https://tokio-rs.github.io/tokio-minihttp/tokio_minihttp/struct.Http.html

With that out of the way, let's take a look at what our actual service
is:

```rust,ignore
use tokio_minihttp::{Request, Response};

struct Server {
    thread_pool: CpuPool,
    db_pool: r2d2::Pool<r2d2_postgres::PostgresConnectionManager>,
}

impl Service for Server {
    type Request = Request;
    type Response = Response;

    // ...
}

// ...

TcpServer::new(tokio_minihttp::Http, addr).serve(move || {
    Ok(Server {
        thread_pool: thread_pool.clone(),
        db_pool: db_pool.clone(),
    })
})
```

Our `Server` is a [`Service`] which will map [`tokio-minihttp`]'s [`Request`]
type to a [`Response`] type. This means that we'll be taking HTTP
requests and returning HTTP responses. When we actually construct a `Server`
we'll be sure to store handles to our [`CpuPool`] to execute work on along
with the pool of database connections as well.

[`Service`]: https://tokio-rs.github.io/tokio-service/tokio_service/trait.Service.html
[`Request`]: https://tokio-rs.github.io/tokio-minihttp/tokio_minihttp/struct.Request.html
[`Response`]: https://tokio-rs.github.io/tokio-minihttp/tokio_minihttp/struct.Response.html
[`CpuPool`]: https://docs.rs/futures-cpupool/0.1/futures_cpupool/struct.CpuPool.html

Now that we've got our server up and running and ready to start servicing
requests, let's start implementing the internals of [`Service`] for our `Server`
type:

```rust,ignore
impl Service for Server {
    type Request = Request;
    type Response = Response;
    type Error = io::Error;
    type Future = BoxFuture<Response, io::Error>;

    fn call(&self, req: Request) -> Self::Future {
        // ...
    }
}
```

We saw `Request` and `Response` types from before, but here we're also filling
out that we're using `io::Error` as our error value and our future will be the
[`BoxFuture`] type alias for a boxed future (trait object). This allows us to
flexibly define the future internally.

[`BoxFuture`]: https://docs.rs/futures/0.1/futures/future/type.BoxFuture.html

Next up, let's start implementing `call`. First we can verify that the HTTP
request is indeed `/db`:

```rust,ignore
assert_eq!(req.path(), "/db");
```

Ideally we'd implement a 404 handler for unrecognized paths, but for now we'll
just panic if you request a different path. Next up let's generate the id of
the row that we're going to look up:

```rust,ignore
let random_id = rand::thread_rng().gen_range(0, 10_000);
```

And now with this in hand comes the real meat. Let's start executing our
database request on our thread pool:

```rust,ignore
let db = self.db_pool.clone();
let msg = self.thread_pool.spawn_fn(move || {
    let conn = db.get().map_err(|e| {
        io::Error::new(io::ErrorKind::Other, format!("timeout: {}", e))
    })?;

    // ...
});
```

Here we're using our `thread_pool` to spawn a unit of work. Inside this closure
we also capture `self.db_pool`. The first thing we do is call `get` which will
block the current thread until it can return a new database connection. In this
case though blocking threads is fine because we're executing on a thread pool.

Once we've got a database connection, we can now use [`postgres`] to load a row
with the `random_id` we generated earlier:

```rust,ignore
let stmt = conn.prepare_cached("SELECT * FROM World WHERE id = $1")?;
let rows = stmt.query(&[&random_id])?;
let row = rows.get(0);

Ok(Message {
    id: row.get("id"),
    randomNumber: row.get("randomNumber"),
})
```

The [`prepare_cached`] method should help us optimize this query slightly, and
otherwise we're just picking the first row and deserializing it into a `Message`
instance in `Rust`.

[`prepare_cached`]: https://docs.rs/postgres/0.13/postgres/struct.Connection.html#method.prepare_cached

At this point we've finished up the work we'll do on the thread pool so return
from [`spawn_fn`] which will complete the future that it returned. To finish up
our implementation of `Service::call` let's take a look at the last piece:

```rust,ignore
msg.map(|msg| {
    let json = serde_json::to_string(&msg).unwrap();
    let mut response = Response::new();
    response.header("Content-Type", "application/json");
    response.body(&json);
    response
}).boxed()
```

The [`spawn_fn`] function returned a [`CpuFuture`] representing the loaded row
(`Message`) above. Our service will take this loaded instance of `Message` and
then transform it to an HTTP response by serializing it to JSON and filling
out a [`Response`] from the [`tokio-minihttp`] crate. Finally we see the
[`boxed`] method is used to package up this whole future into a trait object so
we can return it.

[`spawn_fn`]: https://docs.rs/futures-cpupool/0.1/futures_cpupool/struct.CpuPool.html#method.spawn_fn
[`CpuFuture`]: https://docs.rs/futures-cpupool/0.1/futures_cpupool/struct.CpuFuture.html
[`boxed`]: https://docs.rs/futures/0.1/futures/future/trait.Future.html#method.boxed


Finally before we run the example, we need to set up the database to have a `greetings` table that we can query from. Run the following queries in psql to create and populate the table:

```sql,ignore
CREATE TABLE greetings (
    id serial,
    body text
);

INSERT INTO greetings (body) VALUES
    ('Hello'),
    ('안녕하세요'),
    ('Bonjour'),
    ('好'),
    ('Здравствуйте');
```


### [Complete example](#complete) {#complete}

```rust,no_run
# #![deny(warnings)]
# #![allow(bad_style)]

#[macro_use]
extern crate serde_derive;

extern crate futures;
extern crate futures_cpupool;
extern crate r2d2;
extern crate r2d2_postgres;
extern crate rand;
extern crate serde;
extern crate serde_json;
extern crate tokio_minihttp;
extern crate tokio_proto;
extern crate tokio_service;

use std::io;

use futures::{BoxFuture, Future};
use futures_cpupool::CpuPool;
use r2d2_postgres::{TlsMode, PostgresConnectionManager};
use rand::Rng;
use tokio_minihttp::{Request, Response};
use tokio_proto::TcpServer;
use tokio_service::Service;

struct Server {
    thread_pool: CpuPool,
    db_pool: r2d2::Pool<r2d2_postgres::PostgresConnectionManager>,
}

#[derive(Serialize)]
struct Message {
    id: i32,
    randomNumber: i32,
}

impl Service for Server {
    type Request = Request;
    type Response = Response;
    type Error = io::Error;
    type Future = BoxFuture<Response, io::Error>;

    fn call(&self, req: Request) -> Self::Future {
        assert_eq!(req.path(), "/db");

        let random_id = rand::thread_rng().gen_range(0, 10_000);
        let db = self.db_pool.clone();
        let msg = self.thread_pool.spawn_fn(move || {
            let conn = db.get().map_err(|e| {
                io::Error::new(io::ErrorKind::Other, format!("timeout: {}", e))
            })?;

            let stmt = conn.prepare_cached("SELECT * FROM World WHERE id = $1")?;
            let rows = stmt.query(&[&random_id])?;
            let row = rows.get(0);

            Ok(Message {
                id: row.get("id"),
                randomNumber: row.get("randomNumber"),
            })
        });

        msg.map(|msg| {
            let json = serde_json::to_string(&msg).unwrap();
            let mut response = Response::new();
            response.header("Content-Type", "application/json");
            response.body(&json);
            response
        }).boxed()
    }
}

fn main() {
    let addr = "127.0.0.1:8080".parse().unwrap();
    let thread_pool = CpuPool::new(10);

    let db_url = "postgres://postgres@localhost";
    let db_config = r2d2::Config::default();
    let db_manager = PostgresConnectionManager::new(db_url, TlsMode::None).unwrap();
    let db_pool = r2d2::Pool::new(db_config, db_manager).unwrap();

    TcpServer::new(tokio_minihttp::Http, addr).serve(move || {
        Ok(Server {
            thread_pool: thread_pool.clone(),
            db_pool: db_pool.clone(),
        })
    })
}
```
