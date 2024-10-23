---
date: "2024-10-23"
title: "Announcing Toasty, an async ORM for Rust"
description: "October 23, 2024"
---

[Toasty](https://github.com/tokio-rs/toasty) is an asynchronous ORM for the Rust
programming language that prioritizes ease of use. Toasty supports SQL and NoSQL
databases, including DynamoDB and Cassandra (soon).

Toasty is currently in the early stages of development and should be considered
a "preview" (not ready for real-world usage yet). It also isn't released on
crates.io yet. I am announcing it now as I have made the Github repository open,
will continue development in the open, and am hoping to get feedback.

Projects that use Toasty start by creating a schema file to define the
application's data model. For example, this is the contents of the
[`hello-toasty/schema.toasty`](https://github.com/tokio-rs/toasty/blob/main/examples/hello-toasty/schema.toasty)
file.

```rust
model User {
    #[key]
    #[auto]
    id: Id,

    name: String,

    #[unique]
    email: String,

    todos: [Todo],

    moto: Option<String>,
}

model Todo {
    #[key]
    #[auto]
    id: Id,

    #[index]
    user_id: Id<User>,

    #[relation(key = user_id, references = id)]
    user: User,

    title: String,
}
```

Using the Toasty CLI tool, you will generate all necessary Rust code for working with this data model. The generated code for the above schema is here.

Then, you can easily work with the data model:

```rust
// Create a new user and give them some todos.
User::create()
    .name("John Doe")
    .email("john@example.com")
    .todo(Todo::create().title("Make pizza"))
    .todo(Todo::create().title("Finish Toasty"))
    .todo(Todo::create().title("Sleep"))
    .exec(&db)
    .await?;

// Load the user from the database
let user = User::find_by_email("john@example.com").get(&db).await?

// Load and iterate the user's todos
let mut todos = user.todos().all(&db).await.unwrap();

while let Some(todo) = todos.next().await {
    let todo = todo.unwrap();
    println!("{:#?}", todo);
}
```

# Why an ORM?

Historically, Rust has been positioned as a systems-level programming language.
On the server side, Rust has grown fastest for use cases like databases,
proxies, and other infrastructure-level applications. Yet, when talking with
teams that have adopted Rust for these infrastructure-level use cases, it isn't
uncommon to hear that they start using Rust more often for higher-level use
cases, such as more traditional web applications.

The common wisdom is to maximize productivity when performance is less critical.
I agree with this position. When building a web application, performance is a
secondary concern to productivity. So why are teams adopting Rust more often
where performance is less critical? It is because once you learn Rust, you can
be very productive.

Productivity is complex and multifaceted. No one would disagree that Rust's
edit-compile-test cycle could be quicker. This friction is countered by fewer
bugs, production issues, and a robust long-term maintenance story (Rust's borrow
checker tends to incentivize more maintainable code). Additionally, because Rust
can work well for many use cases, whether infrastructure-level server cases,
higher-level web applications, or even in the client (browser via WASM and iOS,
MacOS, Windows, etc. natively), Rust has an excellent code-reuse story. Internal
libraries can be written once and reused in all of these contexts.

So, while Rust might not be the most productive programming language for
prototyping, it is very competitive for projects that will be around for years.

Okay, so why an ORM? A full-featured library ecosystem for the given use case is
a big piece of the productivity puzzle. Rust has a vibrant ecosystem but has
historically focused more on that infrastructure-level use case. Fewer libraries
target the higher-level web application use case (though, as of recently, that
is changing). Also, many of the libraries that do exist today emphasize APIs
that maximize performance at the expense of ease of use. There is a gap in
Rust's ecosystem. Many teams I spoke with reported that the current state of
Rust's ORM libraries is a big friction point (more than one opted to implement
their in-house database abstraction to deal with this friction). Toasty aims to
fill some of that gap by focusing on that higher-level use case and prioritizing
ease of use over maximizing performance.

# What makes an ORM easy to use?

Of course, this is the million-dollar question. The Rust community is still
figuring out how to design libraries for ease of use. Rust's traits and
lifetimes are compelling, can increase performance, and enable interesting
patterns (e.g., the [typestate](https://cliffle.com/blog/rust-typestate/)
pattern). However, overusing these capabilities also leads to libraries that are
hard to use.

So, when building Toasty, I tried to be sensitive to this and focused on using
traits and lifetimes minimally. This snippet is from code generated from the
schema file by Toasty, and I expect this to be the most complicated type
signature that 95% of Toasty users encounter.

```rust
pub fn find_by_email<'a>(
	email: impl stmt::IntoExpr<'a, String>
) -> FindByEmail<'a> {

	let expr = User::EMAIL.eq(email);
	let query = Query::from_expr(expr);
	FindByEmail { query }
}
```

This does include a lifetime to avoid copying data into the query builder, and I
am still on the fence about it. Based on user feedback, I might remove lifetimes
entirely in the future.

Another aspect of ease of use is minimizing boilerplate. Rust already has a
killer feature for this: procedural macros. Most of you have already used Serde,
so you know what a delight this can be. That said, I opted not to use procedural
macros for Toasty, at least not initially.

Procedural macros generate a lot of hidden code at build time. This isn't a big
deal for libraries like Serde because the Serde macros generate implementations
of public traits (Serialize and Deserialize). Users of Serde aren't really
expected to know the implementation details of those traits.

Toasty is a different story. Toasty will generate many public methods and types
that you will use directly. In the "Hello Toasty" example, Toasty generates the
`User::find_by_email` method. Instead of a procedural macro, I used an explicit
code generation step, where Toasty generates code to a file you can open and
read. Toasty will try to keep this generated code as readable as possible to
make discovering generated methods easy. This added discoverability will result
in an easier-to-use library.

Toasty is still early in development, and the API will evolve based on your
feedback. At the end of the day, if you hit friction, I want to hear about it
and fix it.

# SQL and NoSQL

Toasty supports both SQL and NoSQL databases. As of today, that means Sqlite and
DyanmoDB, though adding support for other SQL databases should be pretty
straightforward. I also plan to add support for Cassandra soon, but I hope
others will also contribute to implementations for different databases.

To be clear, Toasty works with both SQL and NoSQL databases but does **not**
abstract away the target database. An application written with Toasty for a SQL
database will not transparently run on a NoSQL database. Conversely, Toasty does
not abstract away NoSQL databases, and you need to understand how to model your
schema to take advantage of the target database. What I have noticed with
database libraries is that most of each library does the same thing, regardless
of the backend data store: mapping data to structs and issuing basic Get,
Insert, and Update queries.

Toasty starts with this standard feature set and exposes database-specific
features on an opt-in basis. It will also help you avoid issuing inefficient
queries for your target database by being selective about the query methods it
generates.

# Next steps

You should try Toasty, try the examples, and play around with it. Today, Toasty
is still in active development and not ready for real-world use. The immediate
next step will be to fill those gaps. I am aiming to get Toasty ready for
real-world use sometime next year (realistically, towards the end of the year).

Additionally, trying to support SQL and NoSQL the way Toasty does is novel (as
far as I know). If you know prior art, especially pitfalls that previous
attempts have hit, I would love to hear about it. I also know many of you have
strong opinions on working with databases, ORMs, etc., and I am looking forward
to those discussions. There is a #toasty channel in the Tokio
[Discord](https://discord.gg/tokio) for discussion. Also, feel free to create
issues on the [Github repo](https://github.com/tokio-rs/toasty) to propose
features or start a conversation about API design and direction.

<div style="text-align:right">&mdash; Carl Lerche (<a href="https://github.com/carllerche">@carllerche</a>)</div>