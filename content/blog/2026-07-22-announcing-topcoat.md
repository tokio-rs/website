---
date: "2026-07-22"
title: "Announcing Topcoat: a framework for building full-stack reactive web apps with Rust"
description: "July 22, 2026"
---

# Announcing Topcoat: a framework for building full-stack reactive web apps with Rust

[Topcoat] is a modular, batteries-included Rust framework for building full-stack, reactive web apps. It prioritizes simplicity and productivity. Topcoat is entirely server-rendered. Reactivity is added by rendering HTML snippets in the server and adding "reactive instructions" as metadata (similar in idea to HTMX).

Here is the "hello world" app with Topcoat:

```rust
#[tokio::main]
async fn main() {
    topcoat::start(Router::builder().discover().build()).await.unwrap();
}

#[page("/")]
async fn home() -> Result {
    view! {
        <!DOCTYPE html>
        <html>
            <head>
                <title>"Hello world"</title>
                topcoat::dev::script()
            </head>
            <body>
                hello(name: "World")
            </body>
        </html>
    }
}

#[component]
async fn hello(name: &str) -> Result {
    view! {
        <h1>"Hello, " (name) "!"</h1>
    }
}
```

[Getting started guide][guide]

## Motivation

Before getting into more of the technical details, it is worth discussing the motivation behind Topcoat. If you saw my [TokioConf talk][tokioconf] (the one where I predicted that Rust could become a top 3 language for all green-field development), none of this will be a surprise.

Three years ago, if I told you that Rust would be a great language to build web apps with, you probably would call me crazy, and rightfully so. After all, web apps aren't traditionally performance-sensitive applications. So, the right tool for the job would be one that lets you ship fast. Performance is a nice-to-have. Unsurprisingly, the richest web app ecosystems are in languages that put a heavy focus on productivity, like JavaScript, Ruby, and PHP.

However, AI has completely reshaped that calculus. AI erases learning barriers and productivity gaps. The difference in time it takes a modern coding AI tool to build something is primarily a factor of the available set of libraries and not the programming language. Even the operator's specific expertise becomes less important. I have watched experienced software engineers who have never written Rust before work with AI tools to build with Rust from day 1. I'm not talking about vibe coding, but using one's general-purpose engineering experience to work with an AI tool interactively to make progress while learning the language.

Now, I think Rust is a great language, and it has some really great properties (speed and reliability). However, that doesn't mean I think that you should switch to Rust if you already have a stack that works for you and you don't need Rust's performance and reliability (well, I do think you should, but I also know that is my love for Rust and not a practical suggestion). However, many organizations are adopting Rust **because** they have problems to solve that require a performance and reliable language. Organizations that have adopted Rust already have a lot of reason to stay with Rust for higher-level apps, not because they need the performance, but because they already have internal infrastructure (libraries, build systems, processes, ...) around that language, and minimizing the number of programming languages and tools within an organization does improve productivity.

So now, what we need to be productive with Rust for web apps is a rich library ecosystem. That is what I have been building. I started with [Toasty], an ORM for Rust, because it is probably the hardest component. [Toasty] has been ready to use since April of 2026. The next step in the roadmap is a web framework, and that is where [Topcoat] comes in.

Late last year, I met [Julien Scholz][pikaju] and was impressed by his sense of taste and passion for building a great web app framework for Rust, so I convinced him to take the time to build one: [Topcoat].

## Reactivity without WebAssembly

Frameworks like [Leptos](https://leptos.dev/) and [Dioxus](https://dioxuslabs.com/) are excellent for creating highly interactive web applications using Rust by compiling your code to WebAssembly and running it in the browser. However, many applications do not require this level of interactivity. For those use cases, compiling to a separate target, worrying about bundle sizes and splitting, and serializing data across the client/server boundary become a burden. [Topcoat] pursues a simpler approach. All markup is rendered on the server, and so components can be `async`, access the database, or verify user permissions safely. To sprinkle in reactivity, it cross-compiles a subset of fully type-checked Rust expressions to JavaScript using a macro, allowing you to stay in Rust without touching WebAssembly. In this example, the `<button>` reveals the `<p>` tag below when clicked:
```rust
view! {
    // Declare a client-side state variable:
    signal open = false;
    
    <button
        // Configure a Rust closure as the "on click" handler for this button.
        // Code inside the $(...) is run as JavaScript inside the browser:
        @click=$(|_e| open.set(!open.get()))
    >
        "What is Topcoat?"
    </button>
    
    // The `hidden` attribute tracks the value of `open` and updates
    // each time the button is pressed.
    <p :hidden=$(!open.get())>"A fullstack Rust framework."</p>
}
```
The toggling logic runs entirely in the browser, no server round-trip needed.

[Topcoat] can also re-render entire parts of the UI on the server whenever client state changes, and swap out only the necessary part of the page. Here, search results are updated as the user types into the search `<input>` field:

```rust
#[component]
async fn search() -> Result {
    view! {
        signal query = String::new();

        // Write the current text input into the `query` signal:
        <input @input=$(|e: Event| query.set(e.target.value))>

        // Updates as the user types.
        search_results(query: $(query.get()))
    }
}

// Shards are a special type of component that exposes an API endpoint from your router.
#[shard]
async fn search_results(cx: &Cx, query: String) -> Result {
    // This function runs on the server. It can access the database asynchronously.
    view! {
        <ul>
            for product in search_products(cx, &query).await? {
                <li>(product.name)</li>
            }
        </ul>
    }
}
```

The client-side reactivity system is still in the early stages of development and has some limitations. We have many ideas to improve this in the future. In the meantime, you can also make use of the [HTMX](https://docs.rs/topcoat/latest/topcoat/htmx/index.html) and [Alpine.js](https://docs.rs/topcoat/latest/topcoat/alpine_ajax/index.html) integrations.

## A complete toolset for UI development

Building web interfaces is far more complicated than rendering HTML. The web app needs to load custom fonts, stylesheets, images, and more. Topcoat offers a full asset pipeline using the `asset` macro:

```rust
const FERRIS: Asset = asset!("./ferris.png");

view! { <img src=(FERRIS)> }
```

At build time, the Topcoat CLI collects or downloads all your assets and stores them in a single directory. As your application runs, they are served using content hashes to optimize browser caching.

Every good design needs its own fonts and icons. [Fontsource](https://fontsource.org/) and [Iconify](https://iconify.design/) offer huge libraries of freely available fonts and icons for you to use. These can be trivially included in your Topcoat app:
```rust
// Loads the "Roboto" web font from Fontsource.
const ROBOTO: Font = fontsource_font!(ROBOTO);

// Creates a Rust module containing the "feather" icon set.
iconify::include!("feather");
```

Coming up with a cohesive design system and all of its components can be challenging. Component libraries can get you up and running quickly, but often turn out to be inflexible as your design changes. Inspired by [shadcn/ui](https://ui.shadcn.com/), [Topcoat]'s built-in component library is based on [Tailwind](https://tailwindcss.com/) and copies ready-made components directly into your source directory. This means you can modify anything you need and make the design truly your own:

```rust
#[component]
async fn delete_card() -> Result {
    view! {
        card(
            card_header(
                card_title("Delete workspace")
                card_description("This permanently removes the workspace and all of its data.")
            )
            card_footer(
                attrs: attributes! { class="justify-end" },
                button(variant: ButtonVariant::Ghost, "Cancel")
                button(variant: ButtonVariant::Destructive, "Delete workspace")
            )
        )
    }
}
```

## Locality of behavior as the guiding principle

Both humans and AI are better at reasoning across small regions of code. Topcoat is architected from the ground up to allow you to keep logic local and composable. We encourage, for example, letting components do their own data fetching instead of passing data down as component arguments:

```rust
#[component]
async fn user_profile(cx: &Cx, user_id: &str) -> Result {
    // Only this component knows what user data it needs.
    let user = load_user(cx, user_id).await?;
    view! {
        <h1>(user.name)</h1>
        ...
    }
}
```

To avoid fetching data multiple times, Topcoat has built-in request-level memoization, inspired by [React's cache](https://react.dev/reference/react/cache):
```rust
#[memoize]
async fn load_user(cx: &Cx, user_id: &str) -> Result<User> {
    // This database call is made only once per unique `user_id`.
    db(cx).load_user_by_id(user_id).await
}
```

This principle can be extended further to authentication. Instead of relying on middleware in a completely different part of the codebase that may or may not run, you can protect your data directly in the component:

```rust
async fn require_auth(cx: &Cx) -> Result<User> {
    if let Some(Session { user_id }) = current_session(cx).await? {
        Ok(load_user(cx, user_id).await?)
    } else {
        // Data is kept secret, redirect to login.
        Err(redirect("/login").into())
    }
}

#[component]
async fn user_profile(cx: &Cx) -> Result {
    // `user_profile` protects itself from misuse if the user is not logged in!
    let user = require_auth(cx).await?;
    view! {
        <h1>(user.name)</h1>
        ...
    }
}
```

Like hooks in React (but without the dreaded [rules of hooks](https://react.dev/reference/rules/rules-of-hooks)), functions compose nicely by passing the request context (`cx`) around.

## What about Axum

[Axum] is another crate hosted on tokio-rs for building server applications. Because of this, I want to call out that Topcoat and Axum cover very different use cases. In fact, I expect many Topcoat users will end up using Axum as well within their projects. Axum is a lower-level HTTP router that makes it easy to build HTTP API endpoints. You could also use Axum to build a reactive web app, but it would take a lot more boilerplate and setup. Topcoat aims to remove that boilerplate, but if you just want to build those lower-level HTTP endpoints, you should still reach for [Axum].

## What next

This is just the first release of Topcoat. There is a lot on our roadmap, including stuff like tighter integration with [Toasty], Validations, email, etc. You can get a sense for some of it in the [Readme](https://github.com/tokio-rs/topcoat/#roadmap).

In the meantime, [Topcoat] is ready to use now, and if you need a database, pull [Toasty]. Give it a try, and send us questions and/or feedback. We are all on the #topcoat channel in the Tokio [Discord].

Happy building.

<div style="text-align:right">&mdash; <a href="https://github.com/carllerche">Carl Lerche & <a href="https://github.com/pikaju">Julien Scholz</a></div>

[Topcoat]: https://github.com/tokio-rs/topcoat
[Toasty]: https://github.com/tokio-rs/toasty/
[guide]: https://github.com/tokio-rs/topcoat/blob/main/crates/topcoat/docs/getting_started.md
[tokioconf]: https://www.youtube.com/watch?v=d76btqAUWSE
[pikaju]: https://github.com/pikaju
[Axum]: https://github.com/tokio-rs/axum
[Discord]: https://discord.gg/tokio
