---
date: "2026-05-14"
title: "Toasty 0.6.0 - What is new?"
description: "May 15, 2026"
---

It has been a bit more than a month since Toasty's initial [crates.io release],
and what a month it has been, not just with Toasty. We also had our first
[TokioConf] (talk recordings will be announced soon). But, there also has been a
lot of development on Toasty itself. We published v0.4, 0.5, and 0.6. These came
in pretty rapid succession. I didn't have much time to announce them officially,
so I will do it as a batch here.

First, in case you haven't heard about [Toasty] yet. Toasty is an asynchronous ORM
for the Rust programming language that prioritizes ease of use. Toasty supports
both SQL and NoSQL databases. Today, on the NoSQL front, only DynamoDB works,
but I'm hoping to get more support in the coming months. The [guide] has lots of details.

Now, what is new since v0.3.

## More control over selected fields.

Toasty added both [deferred fields] and `.select()`. This lets you control which
fields you want to load when querying models.

Say you have a model, like `Article`

```rust
#[derive(toasty::Model)]
struct Article {
    #[key]
    #[auto]
    id: u64,

    title: String,

    body: String,
}
```

The `body` field might be big (the full body of the article). When querying a
list of articles for an index page, you probably don't want to load the full
body. One way you can do that now is by marking the `body` field as deferred.

```rust
#[deferred]
body: toasty::Deferred<String>,
```

Now, by default, when loading an Article, the `body` field is omitted. You can
either load it on-demand *or* you can eagerly load it the same way you do with
relations:

```rust
Article::filter_by_id(article_id)
    .include(Article::fields().body())
    .get(&mut db)
    .await?;
```

The other way is to explicitly request fields when querying data. This is done
with `select()`. The thing to note there is, since you can pick the fields at
runtime, it doesn't load the actual model *type*, just the fields.

```rust
let titles: Vec<String> = Article::filter_by_id(article_id)
    .select(Article::fields().title())
    .exec(&mut db)
    .await?;
```

You can select more than just one field using a tuple:

```rust
let ids_and_titles: Vec<(u64, String)> = Article::filter_by_id(article_id)
    .select((
        Article::fields().id(),
        Article::fields().title()
    ))
    .exec(&mut db)
    .await?;
```

## `Vec<scalar>` collection fields

You can now have `Vec` fields as long as the item type is a "scalar"
(primitive). So, you can have `Vec<u64>` fields. How these fields are stored
depends on the target database capabilities. PostgreSQL uses arrays, other SQL
databases use JSON storage, and DynamoDB uses its native list storage.

```rust
#[derive(toasty::Model)]
struct Article {
    #[key]
    #[auto]
    id: u64,

    title: String,

    tags: Vec<String>,
}
```

Creating an article works as you would expect it:

```rust
create!(Article {
    title: "hello toasty!",
    tags: ["announcement", "orm"]
}).exec(&mut db).await?
```

Updating the `tags` field can be done using collection operations. Toasty will
translate these to the best operation the target database supports.

```rust
article.update()
    .tags(toasty::stmt::extend(["orm", "async"]))
    .exec(&mut db)
    .await?;
```

Same with querying, there are a bunch of new array specific filter expressions:

```rust
let related = Article::filter(
    Article::fields().tags().intersects(["rust", "toasty"]),
)
.exec(&mut db)
.await?;
```

This is a first step towards the planned "document storage" features, where you
will be able to store, query, and update arbitrary structural data using the
target database's document features. For example, PostgreSQL supports JSON(B)
typed columns and also supports a rich set of query capabilities. Other
databases provide a wide range of similar capabilities. Toasty will be providing
built in support for these sort of access and storage patterns.

What is interesting about the document storage feature, including how well
PostgreSQL supports it, is it continues to advance my belief that the
difference between a good SQL-focused library and a good NoSQL-focused library
isn't actually that different. The amount of overlap between the two is much
bigger than what I anticipated it would be when I started working on Toasty. I'm
pretty excited to see how this aspect evolves.

## Much more

There are quite a number of other improvements. Too many for a blog post,
including more support for query expressions, db-native enums, optimistic
version control, TLS support, etc. We have a lot more on our roadmap and will be
chipping away at it.

Hopefully you give Toasty a spin and share your feedback. The [Tokio Discord]
has a `#toasty` channel where you can ask questions and share the feedback with
Toasty contributors.

[crates.io release]: https://crates.io/crates/toasty
[TokioConf]: https://tokioconf.com
[Toasty]: https://github.com/tokio-rs/toasty
[guide]: https://tokio-rs.github.io/toasty/nightly/guide/
[deferred fields]: https://tokio-rs.github.io/toasty/nightly/guide/deferred-fields.html
[Tokio Discord]: https://discord.gg/tokio
