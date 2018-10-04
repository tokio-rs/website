+++
date = "2018-10-04"
title = "Announcing the Tokio Doc Push (we need you!)"
description = "October 04, 2018"
menu = "blog"
weight = 990
+++

In the past, there has been reoccurring feedback that Tokio is hard to
understand. I believe a lack of good documentation plays a significant part.
It's time to fix this problem.

And because Tokio is open source, it is on us (the community) to make this
happen! 👏

But don't worry, this isn't an aimless request to contribute documentation. It
does, however, require participation. There are ways to get involved at any
level of prior Tokio experience.

## The Tokio documentation push

Here is the plan. A temporary repository
[`doc-push`](http://github.com/tokio-rs/doc-push) has been setup, and that is
where the documentation effort will be coordinated. The README has steps on how
to get started. Roughly, the process will be:

1) Read the existing documentation, tracking parts that are confusing or leave
questions unanswered.

2) Open an issue on the doc-push repository to report the confusion.

3) Fix the issue.

4) Repeat.

Where "fix the issue" is fix an existing guide or write a new guide.

## Writing new guides

To get the effort of writing new guides bootstrapped, the doc-push repository
has been seeded with an [outline] representing my best guess of how the guides
should be structured.

Anyone can volunteer to write a page from this outline. Just submit a PR adding
your Github handle next to the page. For example, if you wanted to volunteer to
write a guide on timeouts, you would submit a PR updating the
[section](https://github.com/tokio-rs/doc-push/blob/master/outline/tracking-time.md#timeouts),
changing **Status: Unassigned** to **Status: Assigned (@myname)**.

Also, feedback and suggestions on the outline structure is greatly appreciated.
Please open issues and PRs agains the outline.

There is also a new [Gitter] channel dedicated to the doc push. If you want to
get involved, but need some guidance. Join the channel and ping us.  Perhaps you
want to try to write a guide, but don't quite feel up to the task yet. Ping us,
and we will help you through it.

## An experiment

The doc push is an experiment. I don't know how it will go, but I am
hopeful that it will be successful.

It is also an iterative effort. Once a pass at improving the guides happens, we
need to go back to step 1) and have new comers try to learn Tokio using the new
documentation. This will expose new gaps which will need to be addressed.

## FAQ

**I don't know Tokio yet!**

First, this isn't a question.

Second, great! You are who we want to get involved. We need fresh eyes to go
over the guides and report issues that they hit.

Things that you can do:

* Read the existing guide and report [issues].
* Brainstorm items for the [cookbook] or ["gotchas"][gotcha] sections.
* Review and provide feedback on [PRs to the website][prs].

**I would like to contribute guides, but I am uncertain that I am able to**

Still not a question!

You know what *they* say: "teaching is the best way to learn". This is a great
opportunity to learn Tokio. First, there are some outlines to get you started.
These outlines will probably result in you having questions or need some
pointers. Perhaps you need to learn the topic first before writing the guide!

We are in the [Gitter] channel waiting eagerly to help you along. We will help
you learn what you need to. In exchange, you will contribute a guide 😊.

## tl;dr

This is your opportunity to help make Tokio easier to learn. It won't happen
without volunteering for the doc push. In short:

1) Join the [Gitter].

2) Watch the [repo].

3) Get involved!

<div style="text-align:right">&mdash; <a href="https://github.com/carllerche">@carllerche</a></div>

[issues]: https://github.com/tokio-rs/doc-push/issues/new
[cookbook]: https://github.com/tokio-rs/doc-push/issues/23
[gotcha]: https://github.com/tokio-rs/doc-push/issues/14
[prs]: https://github.com/tokio-rs/website/pulls
[outline]: https://github.com/tokio-rs/doc-push/blob/master/outline/README.md
[Gitter]: https://gitter.im/tokio-rs/doc-blitz
[repo]: https://github.com/tokio-rs/doc-push
