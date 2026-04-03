---
date: "2026-04-03"
title: "Toasty, an async ORM for Rust, is now on crates.io"
description: "April 3, 2026"
---

Toasty is an asynchronous ORM for the Rust programming language that prioritizes ease of use. Toasty supports both SQL and NoSQL databases. Today, on the NoSQL front, only DynamoDB works, but I'm hoping to get more support in the coming months.

Here is how you might use it:

```rust
#[derive(Debug, toasty::Model)]
struct User {
    #[key]
    #[auto]
    id: u64,

    name: String,

    #[unique]
    email: String,

    #[has_many]
    todos: toasty::HasMany<Todo>,
}

#[derive(Debug, toasty::Model)]
struct Todo {
    #[key]
    #[auto]
    id: u64,

    #[index]
    user_id: u64,

    #[belongs_to(key = user_id, references = id)]
    user: toasty::BelongsTo<User>,

    title: String,
}

// Create a user, the ID is not specified as it is set automatically
toasty::create!(User {
    name: "John Doe",
    email: "john@example.com",
}).exec(&mut db).await?;

// Find the user by email
let user = User::get_by_email(&mut db, "john@example.com").await?;
```

To learn more about how to use Toasty, there is a [user guide][guide] and [API docs][docs].

[guide]: https://tokio-rs.github.io/toasty/nightly/guide/
[docs]: https://docs.rs/toasty

# Why an ORM?

When I originally [announced Toasty][ann] in October 2024, I spoke about this some. The short version is: I believe Rust *can* be a highly productive language for higher-level applications, including more conventional web applications. While Rust may not ever reach the prototyping speed of JavaScript, it brings a lot to the table in other areas. Rust can be a very good language for almost any application, whether it is infrastructure-level high-performance systems, CLI tools, embedding in mobile apps, or even the browser via WASM. Having the ability to use one language, one set of tools, and not have to jump between languages comes with its own productivity boost.

Also, since the original announcement, everything has changed (let me put on my flame-resistant suit). I believe that AI is going to be a big tailwind for Rust adoption. One of the biggest barriers to entry for Rust is just getting started. Even without any "vibecoding", just using AI as a **learning** tool is a big boost. I've seen so many developers become productive with Rust by using AI to learn while also being able to ship code. And AI tools are... not fast, which makes Rust's slow compilation a bit less of a blocker.

Let's be real, the cat is out of the bag — many developers *are* going to let AI "take the wheel." Rust's strong type system and guardrails are going to be an asset there; the more guardrails the language can set for AI tools, the better the end result. And yes, there will be "slop", which is why high-level libraries with strong conventions that take advantage of Rust's type system become critical. Strong abstractions can help limit the slop radius.

But all of that only matters if the ecosystem is there, which means there need to be productive, high-level libraries for building web apps. The ORM is a big piece of that.

[ann]: https://tokio.rs/blog/2024-10-23-announcing-toasty

# What took so long?

I announced working on Toasty over a year ago, and I had already been working on it for a while before that. The initial commit was more than 2 years ago. That is a long time to get to this point.

If you look at the original Toasty I announced back then and Toasty now, the API is very different. You all provided great feedback during the initial announcement that the schema file approach was not good. I listened and went back to the drawing board. I had originally gone with a schema file because getting all the features I wanted with a `#[derive(Model)]` did not seem possible. However, after pushing more on it, I ended up figuring out how! So, thank you all who provided honest feedback :).

It also turned out to be a more ambitious project than I initially anticipated. I didn't have a super clear vision of what I was building going in. I kind of discovered it along the way and had to rewrite the internals a few times as I learned more about the problem space.

# More than an ORM

I am calling it an ORM, but it really is an "application-level query engine." In Toasty, the application schema and the database schema are fully decoupled. When working with Toasty, you write Toasty "statements" directly against the application schema, which is more of a graph than a set of relations. The Toasty query engine then looks at that statement and transforms it into a set of database operations based on the capabilities of the target database.

When I first started working on Toasty, I knew I wanted to try to support NoSQL databases as best as I could. Like I mentioned in the first blog post, the goal is not to **abstract** the database capabilities away, but to try to provide a consistent API across database flavors that makes sense whether you are using SQL or NoSQL. You still need to understand your database's capabilities, model your data appropriately, and be smart about the queries you make, but the specific APIs will be the same.

I initially thought that supporting SQL and NoSQL would be straightforward. Toasty statements would mostly pass through to the database as-is when targeting SQL, and when targeting NoSQL, the query engine would do a planning pass to figure out if and how it could execute the query. However, I found that I actually had to lean on the "query engine" aspect a lot more than I initially expected, even with SQL. There are quite a few query patterns that are useful for applications but are not easy to express in SQL. For example, updating a row by key with a precondition and being able to distinguish between "the key wasn't found" and "the precondition failed." With PostgreSQL, that requires writing it as a CTE with multiple queries. So, even on the SQL side, the query engine ended up doing a lot of heavy lifting.

# What is next?

This is just an early release. Toasty is a big project without much real-world usage (yet). A big thanks to the brave souls who tried Toasty so far and provided feedback and pointed out gaps. At this point, Toasty's capabilities should be advanced enough to start building with, at least at a basic level. There are still many capabilities to add, but now that the core foundation is solid, I'm optimistic that progress will be relatively fast. In fact, the past few months have been incredibly productive in terms of adding new capabilities.

I expect we will be releasing breaking changes as `0.x` releases pretty often, so there will be churn. I also expect there will be rough edges and bugs as people try it out, but I will be working hard to keep up with it!

So please give Toasty a spin and let me know what you think! Read the docs, share your feedback in [GitHub discussions][discussion], in [Discord] (#toasty channel), or even in person with me at [TokioConf] in a couple of weeks!

[TokioConf]: https://tokioconf.com
[discussion]: https://github.com/tokio-rs/toasty/discussions
[Discord]: https://discord.gg/tokio
