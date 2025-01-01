---
date: "2025-01-01"
title: "Announcing axum 0.8.0"
description: "January 01, 2025"
---

Happy new year! 🎉

Today, we're happy to announce [`axum`] version 0.8. `axum` is an ergonomic
and modular web framework built with [`tokio`], [`tower`], and [`hyper`].

This also includes new major versions of [`axum-core`], [`axum-extra`], and
[`axum-macros`].

Here is a small selection of the most notable changes in this release:

## Path parameter syntax changes

The path parameter syntax has changed from `/:single` and `/*many` to
`/{single}` and `/{*many}`.

There are many reasons for this change, but the most important one is that the
old syntax was not allowing route definitions with leading `:` or `*`
characters.

This new syntax was introduced with our upgrade to [`matchit`] 0.8. It should
feel somewhat familiar from the `format!()` macro, and it's also the syntax
that is being used in [OpenAPI] descriptions. Escaping is done with double
braces, so if you want to match a literal `{` or `}` character, you can do so
by writing `{{` or `}}`.

We understand that this is a breaking change for basically all axum users, but
we believe that it's better to make this change now than to have to do it later
when even more users depend on the old syntax. The migration path should also
be relatively straightforward, so we hope that this change won't cause too much
trouble for you.

You can find more information and migration examples in the corresponding
[pull request](https://github.com/tokio-rs/axum/pull/2645). Thank you to
[David Mládek](https://github.com/mladedav) for the implementation in `axum`
and to [Ibraheem Ahmed](https://github.com/ibraheemdev/matchit) for your
continued work on `matchit`.

## `Option<T>` as an extractor

The way `Option<T>` is used as an extractor has changed. Previously, any
rejections from the `T` extractor were simply ignored and turned into `None`.

Now, `Option<T>` as an extractor requires `T` to implement the new trait
`OptionalFromRequestParts` (or `OptionalFromRequest`).

This makes it possible to handle rejections from the `T` extractor and turn them
into error responses, while still allowing extractors to be optional.

Imagine you have an `AuthenticatedUser` extractor that requires a valid token
to be present in the request, but in some cases authentication is optional.
You can now use `Option<AuthenticatedUser>` as an extractor without losing the
ability to return an error response if the token is invalid or the database
connection failed.

Thank you to [Jonas Platte](https://github.com/jplatte) for the
[pull request](https://github.com/tokio-rs/axum/pull/2475) that introduced this
new capability.

## `#[async_trait]` removal

In late 2023, the Rust team made it possible to use `impl Future<Output = _>`
in traits. This feature is called [return-position `impl Trait` in traits](https://blog.rust-lang.org/2023/12/21/async-fn-rpit-in-traits.html).
and means that we no longer need the `#[async_trait]` macro to define async
methods in traits.

This change primarily affects our `FromRequestParts` and `FromRequest` traits,
since they use async methods. If you have custom extractors that implement these
traits, you will need to remove the `#[async_trait]` annotation from them.

This [change](https://github.com/tokio-rs/axum/pull/2308) was implemented by
[Zheng Li](https://github.com/lz1998). Thank you for your contribution!

## See the changelog for more

There are many more changes in this release, including new features, bug fixes,
and less visible breaking changes. We encourage you to read the [changelog] to
see all the changes!

Also, please [open a GitHub discussion] if you have trouble updating. You're
also welcome to ask questions in [Discord].

Finally, we want to thank all the [contributors](https://github.com/tokio-rs/axum/graphs/contributors)
who helped make this release possible. Your work is greatly appreciated!

<div style="text-align:right">&mdash; <a href="https://github.com/tokio-rs/axum/discussions/3099">the axum maintainers</a></div>

[`axum`]: https://crates.io/crates/axum
[`axum-core`]: https://crates.io/crates/axum-core
[`axum-extra`]: https://crates.io/crates/axum-extra
[`axum-macros`]: https://crates.io/crates/axum-macros
[`tokio`]: https://crates.io/crates/tokio
[`tower`]: https://crates.io/crates/tower
[`hyper`]: https://crates.io/crates/hyper
[`matchit`]: https://crates.io/crates/matchit
[changelog]: https://github.com/tokio-rs/axum/blob/main/axum/CHANGELOG.md
[Discord]: https://discord.gg/tokio
[open a GitHub discussion]: https://github.com/tokio-rs/axum/discussions
[OpenAPI]: https://www.openapis.org/
