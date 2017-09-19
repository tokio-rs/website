+++
title = "An RFC for a Tokio revamp"
description = "19 September 2017"
menu = "blog"
+++

Hi there, Tokio community!

Carl, Alex, and myself have been hard at work developing ways to simplify,
streamline, and focus the Tokio project. As part of this effort, we have
written the first-ever Tokio [RFC]!

Here's a quick run-down of what's being proposed.

* Add a global event loop in `tokio-core` that is managed automatically by
  default. This change eliminates the need for setting up and managing your own
  event loop in the vast majority of cases.

  * Moreover, remove the distinction between `Handle` and `Remote` in
  `tokio-core` by making `Handle` both `Send` and `Sync` and deprecating
  `Remote`. Thus, even working with custom event loops becomes simpler.

* Decouple all task execution functionality from Tokio, instead providing it
  through a standard futures component. As with event loops, provide a default
  global thread pool that suffices for the majority of use-cases, removing the
  need for any manual setup.

  * Moreover, when running tasks thread-locally (for non-`Send` futures),
    provide more fool-proof APIs that help avoid lost wakeups.

* Provide the above changes in a new `tokio` crate, which is a slimmed down
  version of today's `tokio-core`, and may *eventually* re-export the contents
  of `tokio-io`. The `tokio-core` crate is deprecated, but will remain available
  for backward compatibility. In the long run, most users should only need to
  depend on `tokio` to use the Tokio stack.

* Focus documentation primarily on `tokio`, rather than on
  `tokio-proto`. Provide a much more extensive set of cookbook-style examples
  and general guidelines, as well as a more in-depth guide to working with
  futures.

Altogether, these changes, together with [async/await], should go a long
distance toward making Tokio a newcomer-friendly library. Please take a look at
the [RFC] and leave your feedback!

Once we've reached consensus on the RFC, we plan to form an impl period *working
group*, focused primarily on docs and examples. And from there, we will be
working with the Hyper team to figure out the next chapter of that story. Stay tuned!

[async/await]: https://internals.rust-lang.org/t/help-test-async-await-generators-coroutines/5835
[RFC]: https://github.com/carllerche/tokio-rfcs/pull/2
