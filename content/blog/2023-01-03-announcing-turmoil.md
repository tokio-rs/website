---
date: "2023-01-03"
title: "Announcing turmoil"
description: "January 3, 2023"
---

Today, we are happy to announce the initial release of [`turmoil`][crates.io],
a framework for developing and testing distributed systems.

[crates.io]: https://crates.io/crates/turmoil

Testing distributed systems is hard. Non-determinism is everywhere (network,
time, threads, etc.), making reproducible results difficult to achieve.
Development cycles are lengthy due to deployments. All these factors slow down
development and make it difficult to ensure system correctness.

`turmoil` strives to solve these problems by simulating hosts, time and the
network. This allows for an entire distributed system to run within a single
process on a single thread, achieving deterministic execution. We also provide
fine grain control over the network, with support for dropping, holding and
delaying messages between hosts.

## Getting Started

To use `turmoil`, add the crate to your `Cargo.toml` file:

```toml
[dev-dependencies]
turmoil = "0.3"
```

Similar to [`loom`][loom], we provide simulated networking types that mirror
`tokio::net`. Define a new module in your crate named `net` any other name of
your choosing. In this module, list out the types that need to be toggled
between `turmoil` and `tokio::net`:

```rust
#[cfg(not(feature = "turmoil"))]
pub use tokio::net::*;

#[cfg(feature = "turmoil")]
pub use turmoil::net::*;
```

Then, write your software using networking types from this local module. 

```rust
#[cfg(feature = "turmoil")]
mod simulation {
    #[test]
    fn simulate_it() -> turmoil::Result {
        // build the simulation
        let mut sim = turmoil::Builder::new().build();

        // setup a host
        sim.host("server", || async move {
            // host software goes here
        });

        // setup the test
        sim.client("test", async move {
            // dns lookup for "server"
            let addr = turmoil::lookup("server");

            // test code goes here

            Ok(())
        });

        // run the simulation
        sim.run()
    }
}
```

Each host (including the test code) runs on its own [`Runtime`][runtime], which is
managed by the simulation. Within `run()`, the simulation steps each runtime a
configurable duration until the test code completes.

[loom]: https://docs.rs/loom/latest/loom/#writing-tests
[runtime]: https://docs.rs/tokio/latest/tokio/runtime/index.html

## What's next?

This crate is still experimental. Your use cases and feedback are invaluable in
guiding our development.

Please [file issues][issues] and [ping us on Discord in
#turmoil-sumulation][discord].

Happy testing!

[issues]: https://github.com/tokio-rs/turmoil/issues
[discord]: https://discord.gg/tokio

<div style="text-align:right">
   &mdash; Brett McChesney (<a href="https://github.com/mcches">@mcches</a>)
</div>