+++
date = "2020-04-01"
title = "Announcing: tracing-flame"
description = "May 1, 2020"
menu = "blog"
weight = 982
+++

If you're not already familiar, [`tracing`] is a framework for instrumenting
Rust programs to collect structured, event-based diagnostic information. It is
designed to act as a framework for building logging, performance, and other
diagnostic libraries ontop of it, such as [`tracing-honeycomb`] or
[`tracing-error`]. Tracing lets you compose [`Layer`]s of such libraries into
comprehensive diagnostic systems, and [`tracing-flame`] provides such a layer
designed for performance analysis.

`tracing-flame`'s design is relatively simple, it captures these span entry /
exit events and outputs them like stack-traces in a format [`inferno`] can then
use to create a flamegraph.

# Simple Example

# Speeding Up Vector

run tests with flame

run same tests with perf

compare flamegraphs

find something that looks slow

fix it

# Conclusion


<div style="text-align:right">&mdash;Jane Lusby</div>

