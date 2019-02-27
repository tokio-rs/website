+++
title = "Google Summer of Code"
description = ""
+++

This is the list of ideas for students wishing to apply to Google Summer of
Code. For more information on what the program is and how to apply, see the
[student guide](https://google.github.io/gsocguides/student/). If you're
interested in applying we would love to get to know you more on
[Gitter](https://gitter.im/tokio-rs/gsoc).

The most successful projects are often those proposed by the students
themselves. The following list represents some of our ideas and wishes for the
project. However, suggesting your own idea is always encouraged. Jump over to
[Gitter](https://gitter.im/tokio-rs/gsoc) and chat with us!

---

## Tokio console

Tokio provides an instrumentation API using Tokio Trace as well as a number of
instrumentation points built into Tokio itself as well as the Tokio ecosystem.
The goal of the project is to implement a subscriber to these instrumentation
points that exports the data out of the process via a gRPC endpoint. Then,
implement a console based UI that connects to the process and allows the user to
visualize the data.

### Expected outcomes

* A Tokio Trace subscriber that listens to all events
* A gRPC server that exports instrumentation data to connected clients.
* A console based UI that allows users to query and visualize the data.

### Skills

* Rust
* gRPC

### Difficulty level

Medium

---

## Loom

Loom is a model checker for concurrent Rust code and is used to test Tokio's
concurrency primitives. It explores the behaviors of code under the C11 memory
model, which Rust inherits. It attempts to avoid combinatorial explosion by
pruning the state space. Currently, loom checks can take a long time as it does
an exhaustive search of all possible executions.

The goal of the project is to make it possible to use loom to check concurrent
code in 10 seconds or less. This requires:

1. Making the loom runtime faster
1. Implement [bounded exploration](https://www.microsoft.com/en-us/research/publication/bounded-partial-order-reduction).

### Expected outcomes

Tokio's loom based tests complete in 10 seconds or less on a modern personal computer.

### Stretch goals

* Add atomic fence support.
* Increase C11 memory model coverage.

### Skills

* Rust
* Concurrency

### Difficulty level

Hard

---

## Improve Mio windows support

Mio is a low level abstraction on top of the operating system's evented I/O
APIs. It is used by Tokio to integrate with the operating system and perform the
I/O operations. The current Windows implementation is not ideal. A better
solution is outlined in
[piscisaureus/wepoll](https://github.com/piscisaureus/wepoll).

### Expected outcomes

The windows Mio implementation is rewritten using the strategy used by wepoll.

### Skills

* Rust
* Windows networking

### Difficulty level

Medium

---

## Tokio crate release automation

Tokio consists of many small, decoupled crates (a crate is a Rust library
package). Releasing changes has become a manual and error prone process. The
goal of the project is to build a set of tools to automate crate releases such
that the entire flow can be done via the GitHub issue tracker.

### Expected outcomes

* Changelog entries are generated based off of data in PRs including title and labels.
* Crates are released on a weekly (configurable) basis.
* A bot opens a PR for the release
* When the release PR is merged, the crate is pushed to crates.io.
* A Github status check is used to ensure that PRs include enough data to generate a changelog entry.
* An automated GitHub action that merges master into PRs when there are no merge conflicts.

### Skills

* GitHub
* TravisCI
* Bash

### Difficulty level

Easy

---

## Tower Web templating engine

Tower Web is a web framework built on top of the Tokio stack. It provides a
macro based API. It currently supports HTML templates using an existing
community handlebars library. However, better HTML templating, both in terms of
features and performance, can be achieved by implementing a custom library.

### Expected outcomes

* A handlebars based templating library is implemented.
* Templates are compiled ahead of time using a procedural macro.
* Templates are rendered into a rope data structure.
* A rope data structure is implemented.

### Skills

* Rust
* Parsing

### Difficulty level

Medium

---

## Improve gRPC server

Tower gRPC provides a gRPC client / server implementation on top of the Tokio
stack. Currently, the server API is tedious to use and has some limitations. The
goal for the project is to implement a procedural macro to remove the
boilerplate when defining gRPC server services. Also, a routing layer should be
implemented in order to allow multiple gRPC services to respond on the same
socket.

### Expected outcomes

* A procedural macro generating server related boilerplate.
* Multiple services are able to respond on a single socket.

### Skills

* Rust
* gRPC

### Difficulty level

Medium
