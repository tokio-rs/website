---
date: "2021-09-08"
title: "Console Dev Diary #1"
description: "September 8, 2021"
---

Since the start of a Tokio Console [prototype][] a few months ago, we've been hard at work turning
it into an awesome async task debugger. We wanted to provide some concentrated updates around how
it's been progressing.

## What's the Console?

> wow! whoa! it's like `top(1)` for tasks!

The [Console][repo] is a Rust async debugging tool. The goal is to make _the_ tool you reach for
when trying to better understand how your async tasks are behaving. It makes use of `tracing` events
and spans, and thus is aimed at being runtime-agnostic.

## Updates


**Easy `init` and `Builder`:** We made it way easier to add instrumentation to your app. For most,
simply adding `console_subscriber::init()` to the top of your `main` function is enough! It will use
sensible defaults, checking some environment variables for customization. and build an isolated
subscriber. There's also a convenient `console_subscriber::Builder` API if you need more control
integrating with existing `tracing` or runtimes.

![task list screenshot](https://user-images.githubusercontent.com/2796466/129774465-7bd2ad2f-f1a3-4830-a8fa-f72667028fa1.png)

**Everything is prettier!** The main list view looks a lot better. We made task "names" a
first-class thing, getting their own column in the list. Task IDs were made prettier and more
consistent with what a user would expect. There's better better color and UTF-8 usage, which by
default checks what the terminal supports. For example, fields displaying durations use a subtlely
different color for different magnitudes (nanoseconds vs milliseconds vs seconds).

![task details screenshot](https://user-images.githubusercontent.com/2796466/129774524-288c967b-6066-4f98-973d-099b3e6a2c55.png)

**You can select a task to see a "Task Details" view.** This includes more details and metrics about
that task. There's a graphed histogram of all the poll times for the task, letting you see how long
your tasks take to do work before yielding. There's also information about how many times a task has
been woken, which you can compare with the number of times polled, as well as time since the last
wake call.

**Temporality:** After some user inteviews, we prioritized some "time control" features for the
console. We've so far implemented the ability to pause the console (and still explore the existing
tasks), and then resume back to "live". There's now an option to record all relevant events to a
file on disk, with the goal of being able to replay that file in the `console`.

**Video Demo:** We put together a [demo showing off the console][yt], and how to use it to debug
some common task misbehaviors.


## Thanks to...

- Eliza Weisman
- Sean McArthur
- Zahari Dichev
- Oğuz Bilgener
- @gneito
- @memoryruins
- Jacob Rothstein
- Artem Vorotnikov
- David Barsky
- Wu Aoxiang

We also want to thank all of you have been trying it out in your applications and giving us valuable
feedback!

There's [plenty more][repo] to be done. [Want to join us?][issues]

[prototype]: https://www.reddit.com/r/rust/comments/n5qs83/tokioconsole_a_new_debugging_tool_for_async_rust/
[yt]: https://www.youtube.com/watch?v=JGCewPUvF70
[repo]: https://github.com/tokio-rs/console
[issues]: https://github.com/tokio-rs/console/issues
