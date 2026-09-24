---
date: "2026-09-24"
title: "Topcoat is pushing the boundary of server applications with Rust"
description: "September 24, 2026"
---

[Two months][ann] ago, we ([Julien] and [I][Carl]) announced [Topcoat], a
batteries-included full-stack Rust framework. It includes views, components,
mailers, an ORM ([Toasty]), and more. Topcoat aims to make building web apps
with Rust as productive as any other language. We have been hard at work
shipping features, so it is a good time to talk about what is new.

I started my career as a professional software developer building web
applications with Ruby on Rails. At the time, the [“build a blog in 15 minutes”
video][blog-video] was groundbreaking. Back then, building software was tedious: writing
boilerplate instead of shipping features. Ruby on Rails challenged that and
proved you could be productive and that building software could also be fun. I
fell in love with Ruby on Rails, worked on the core team for a few years, and am
still a top [50 all-time contributor][contrib] to Ruby on Rails. Having been
through that period, it is hard to overstate how impactful the Ruby on Rails
philosophy was on software development in general.

Since then, I have spent the past 13 years or so building up Rust’s networking
ecosystem. While Rust has gained broad adoption at the infrastructure level, I
have always had higher-level application development in my sights, including the
same space Ruby on Rails occupies. I've wanted to capture some of the magic I
felt when I built Ruby on Rails applications, but with Rust (who doesn’t like
really, really fast applications that take ~20MB of RAM?).

I will be the first to say Rust isn't as elegant as some other modern languages,
but I'd definietly rather work with Rust than pour acid into my eyes. Also, most
higher-level applications can get away with minimal use of lifetimes and
generics. Rust is very expressive. Applications built with Rust and
well-designed libraries can look nice.

Rust is the best general-purpose language for the new world of AI-driven
development. That includes building web applications or any server application,
really. The role of libraries and frameworks in this new world is still up in
the air. The cost of ditching a library or framework and using a bespoke
solution has gone down, but not disappeared entirely. They will continue to play
a substantial, but slightly different role. Well-defined conventions and
abstractions will help the LLM work faster, with fewer tokens and fewer errors.
That is fundamentally why I am still pushing for a batteries-included framework
for Rust.

I partnered with Julien, who has been leading the front-end design of Topcoat
while I mostly focus on Toasty and the DB layer. We are still figuring out
exactly what this new framework should look like, but it is shaping up to be
something very nice.

With that, what is new with Topcoat and Toasty?

# Client-side reactivity in Topcoat 0.9 and beyond

Today, we published [Topcoat v.0.9](https://github.com/tokio-rs/topcoat/releases/tag/v0.9.0).

When starting to build a web framework, you typically choose to either build a
browser-side renderer or a server-side renderer. If you start with browser
rendering, the challenge becomes getting data from the server to the browser and
rendering the initial page as quickly as possible. If you start on the server,
data access and initial page load become easy, but now latency and client-side
responsiveness become the bottleneck. Regardless of where you start, you
typically converge more and more towards the middle to get the best of both
worlds. We believe server-side rendering is the best default for most web apps,
but we want to make sure you can drop down to fully interactive, zero-latency
UIs when needed.

## Tracking client signals on the server

Topcoat started with signals and a special runtime expression syntax inside the
view! macro: a fully type-checked subset of Rust that can be transpiled to
JavaScript and re-run in the browser. The idea is to have as much of the
rendering and business logic on the server, and only sprinkle in runtime
expressions to bridge the latency gap, for example by revealing a loading
spinner or changing some class attributes. With a system like this, it is
possible to build basic interactivity while avoiding server roundtrips entirely:

```rust
#[page]
pub async fn page(cx: &Cx) -> Result<impl View> {
    // This state variable is initialized on the server, but lives in the browser.
    let count = signal(cx, || 0i32);

    Ok(view! {
        <button @click=$(|_e| count.increment())>"increment"</button>
        <button @click=$(|_e| count.decrement())>"decrement"</button>

        // The count updates when clicking the buttons. No server roundtrip.
        <div>$(count.get())</div>
    })
}
```

However, by themselves, Topcoat’s runtime expressions fall short when you need
to make changes to the structure of the markup itself. To fix this, we added
shards, which are a special type of component that can be re-rendered on the
server whenever their arguments change:

```rust
#[component]
async fn search(cx: &Cx) -> Result<impl View> {
    let query = signal(cx, String::new);

    Ok(view! {
        <input @input=$(|e: Event| query.set(e.target.value))>

        // Search results are updated as the input changes.
        search_results(query: $(query.get()))
    })
}

#[shard]
async fn search_results(cx: &Cx, query: String) -> Result<impl View> {
    // This markup is rendered on the server and can access the database.
    Ok(view! {
        <ul>
            for product in search_products(cx, &query).await? {
                <li>(product.name)</li>
            }
        </ul>
    })
}
```

When the `query` signal changes, the browser sends its current value to the
server, which reruns the shard and responds with updated HTML.

In [Topcoat 0.8][topcoat-0.8], reacting to signal changes became even easier. You can now read
a signal while rendering your UI on the server. Since the outcome depends on
whatever values the signals have, Topcoat will refetch just those parts of your
page that track the signal value:

```rust
#[shard]
pub async fn search(cx: &Cx) -> Result<impl View> {
    let query = signal(cx, String::new);
    // The signal is read here, meaning the shard will re-run
    // on the server whenever the browser-side state changes.
    let products = search_products(cx, &query.get()).await?;

    Ok(view! {
        // The input event handler still runs in the browser.
        <input @input=$(|e: Event| query.set(e.target.value))>

        <ul>
            for product in products {
                <li>(product.name)</li>
            }
        </ul>
    })
}
```

Updated HTML elements are morphed to avoid loss of focus or input state. Even an
entire page can be re-rendered in response to a signal change, providing
significantly more expressiveness.

## Streaming UI changes from the server

Responding to client state changes on the server is great, but what if you want
to update the UI in response to a server-side state change? For this use case,
Topcoat provides the `live!` and `emit!` macros. A `live!` view is a special
type of view! that can emit unlimited UI updates.

A simple example is “streaming SSR,” or “suspense.” The goal is to render a
loading skeleton as quickly as possible while waiting for data. Once the data is
available, you can swap in the real page content. Topcoat provides `suspense` and
`error_boundary` components out of the box that behave similarly to
[React][suspense] and other web frameworks. That said, you can achieve a similar
effect with a live view:

```rust
#[page]
pub async fn page() -> Result<impl View> {
    Ok(live! {
        // First, emit a loading indicator.
        emit! { <p>"Loading..."</p> }?;

        // Then, load the data.
        let content = load_content().await;

        // Finally, swap in the full UI.
        emit! { <p>(content)</p> }
    })
}
```

A more advanced use case is to emit a progress indicator that updates many times
as the page loads:

```rust
#[page]
pub async fn page(cx: &Cx) -> Result<impl View> {
    Ok(live! {
        // Start at 0%.
        emit! { <p>"Working... 0%"</p> }?;

        while let Some(progress) = load_more_data(cx).await? {
            // Each time new data arrives, we update the progress indicator.
            emit! {
                <p>
                    "Working... "
                    (progress.percent)
                    "%"
                </p>
            }?;
        }

        emit! { <p>"Done!"</p> }
    })
}
```

Starting with version 0.9, [Topcoat] also supports server-push. Instead of
streaming only for the initial page load, [Topcoat] can open a WebSocket
connection from the browser to the server and subscribe to UI changes over
long-lived connections. This is useful, for example, for a chat interface:

```rust
#[component]
pub async fn chat_messages(cx: &Cx) -> Result<impl View> {
    Ok(live! {
        let chat = app_context::<Chat>(cx);
        let mut changed = chat.subscribe();
        loop {
            // Render the current chat state.
            let token = emit! {
                <ul>
                    for message in chat.messages() {
                        <li>(message)</li>
                    }
                </ul>
            }?;

            // During the initial page load, only render once.
            if !connected(cx) {
                break Ok(token);
            }

            // Wait for changes, then re-render the chat box.
            changed.recv().await.ok();
        }
    })
}
```

# Toasty, Topcoat’s DB client

[Toasty] has received many incremental updates over the months. I’m just going
to highlight a few of them quickly.

## Expressive updates

Procedural macros are one of Rust’s killer features. A procedural macro-based
API can be very expressive while still providing type safety. Toasty uses these
heavily to minimize boilerplate when querying, creating, and updating. We
recently added the `update!` macro:

```rust
#[derive(Model)]
struct User {
    #[key]
    #[auto]
    id: i64,

    name: String,
    login_count: i64,
}

// let mut user = ...;

toasty::update!(user {
    name: "Alicia",
    login_count.increment(),
})
.exec(&mut db)
.await?;
```

This runs a single update that sets the name field and increments `login_count`
in the database (without loading it first, something like `SET login_count =
login_count + 1`).

## Document fields

Toasty is not just for relational data. Document-based databases are common, and
most relational databases (including PostgreSQL) support document types, like
JSON, including the ability to query document columns. Toasty is adding
first-class support for that. Here is a quick example:

```rust
#[derive(Model)]
struct User {
    #[key]
    #[auto]
    id: i64,

    name: String,

    #[document]
    settings: Settings,
}

#[derive(Embed)]
struct Settings {
    theme: String,
    notifications: bool,
}

let users = User::filter(
    User::fields().settings().theme().eq("dark"),
)
.exec(&mut db)
.await?;
```

The user’s `settings` field is encoded as JSONB in PostgreSQL, and the filter
uses PostgreSQL’s JSONB filtering capabilities. The filter query looks like
this:

```sql
SELECT
    users.id,
    users.name,
    users.settings
FROM users
WHERE users.settings->>'theme' = $1;
```

## Polymorphic relations

Polymorphic relations are relations where the target may be one of multiple
types. I have never loved how they worked in ORMs that I have used in the past.
Yet, there are valid reasons to need them. Then, I realized that you could
basically get polymorphic relations with Toasty by combining enums with regular
relations.

```rust
#[derive(Embed)]
#[index(id)]
enum Owner {
    User {
        #[shared(id)]
        id: i64,
        #[belongs_to(key = id)]
        user: Deferred<User>,
    },
    Team {
        #[shared(id)]
        id: i64,
        #[belongs_to(key = id)]
        team: Deferred<Team>,
    },
}

#[derive(Model)]
struct Project {
    #[key]
    #[auto]
    id: i64,

    name: String,
    owner: Owner,
}
```

The `#[shared(id)]` and `#[index(id)]` annotations tell Toasty what the table schema
looks like. shared says the id field from both enum variants map to the same DB
column, and `#[index]` says to create a database index. And using it works pretty
well too:

```rust
// Toasty fills the owner's ID from Alice's primary key.
let mut project = toasty::create!(Project {
    name: "Website",
    owner: Owner::User { user: &alice },
})
.exec(&mut db)
.await?;

// Find projects owned by Alice.
let projects = Project::filter(
    Project::fields()
        .owner()
        .user()
        .matches(|owner| owner.user().eq(&alice)),
)
.exec(&mut db)
.await?;

// Transfer ownership to a team.
toasty::update!(project {
    owner: Owner::Team { team: &team },
})
.exec(&mut db)
.await?;
```

# Where to go from here

Look, I don’t know where we are going. The world of software engineering is
completely different every three months. Who knows where it will land? I sure as
hell don’t. What I do know is that I am very excited. I feel like I am living
through science fiction, and the future is bright. Is Rust going to be part of
the destination? Maybe. Maybe not. It will definietly play a big part in the
journey. There is no reason we can’t maximize productivity AND have a really
high-quality app that runs fast and uses little memory. 

And for web apps, I will be building with Rust, [Topcoat], and [Toasty].

To give it a try, follow the [getting started guide][getting-started], and come
say hi in the #topcoat channel on the Tokio [Discord].

<div style="text-align:right">&mdash; <a href="https://github.com/carllerche">Carl Lerche</a> & <a href="https://github.com/pikaju">Julien Scholz</a></div>

[Julien]: https://github.com/pikaju
[Carl]: https://github.com/carllerche
[Topcoat]: https://github.com/tokio-rs/topcoat
[Toasty]: https://github.com/tokio-rs/toasty
[topcoat-0.8]: https://github.com/tokio-rs/topcoat/releases/tag/v0.8.0
[suspense]: https://react.dev/reference/react/Suspense
[ann]: https://tokio.rs/blog/2026-07-22-announcing-topcoat
[contrib]: https://contributors.rubyonrails.org/contributors/carl-lerche/commits
[blog-video]: https://www.youtube.com/watch?v=Gzj723LkRJY
[getting-started]: https://github.com/tokio-rs/topcoat/blob/main/crates/topcoat/docs/getting_started.md
[Discord]: https://discord.gg/tokio
