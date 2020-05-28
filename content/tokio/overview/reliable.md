---
title: Tokio is Reliable
menu: "Reliability"
---

Tokio's number one goal is to enable secure and reliable applications. While
speed is a worthy goal, it is of no benefit if it results in the wrong behavior,
or worse, security vulnerabilities. A big part of this is building on top of the
Rust programming language. The rest comes from design decisions, both internal
and at the API level.

# Memory safety

A large percentage of high severity bugs tend to be memory unsafety problems.
Chromium, iOS, macOS, and Microsoft estimate that number to be around 70%. This
category of bugs includes out-of-bounds memory access and use-after-free, which
tends to result in security vulnerabilities. High profile vulnerabilities
WannaCry, Trident, and Heartbleed where all memory unsafety bugs.

TODO: more

# Misuse resistance

TODO: How does Tokio prevent API misuse using Rust's type system? RAII probably,
cancellation on drop, anything else?

# Backpressure

TODO: talk about how Tokio handles most backpressure situations out of the box.

# Fairness

TODO: How the scheduler focuses on fairness.

# Correctness

TODO: test suite & loom.
