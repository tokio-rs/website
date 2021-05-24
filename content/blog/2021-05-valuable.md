---
date: "2021-05-24"
title: "Announcing Valuable, a library for object-safe value inspection"
description: "May 24, 2021"
---

Over the past few weeks, we have been working on [Valuable][crate], a new crate
that provides [object-safe] value inspection. It is almost ready to publish, so
I thought I'd write an article to introduce it. The crate offers an object-safe
trait, [`Valuable`][trait], that allows callers to inspect the contents of the
value, whether fields, enum variants, or primitives, without knowing its type.
Initially, we wrote Valuable to support [Tracing]; however, it is helpful in
several scenarios. Object-safe value inspection is a bit of a mouthful, so let's
start by looking at [Tracing] and why it is needed there.

[Tracing] is a framework for instrumenting Rust programs to collect structured,
event-based diagnostic information. Some consider it a structured logging
framework, and while it can fill that use case, it can do a lot more. For
example, [Console] aims to become a powerful tool for debugging async Rust
applications and uses Tracing as its backbone. [Tokio] and other libraries emit
instrumentation via Tracing. Console aggregates the events into a model of the
application's execution, enabling the developer to gain insights into bugs and
other issues.

![Instrumentation -> trait object -> event collection](https://i.imgur.com/YJIrHK2.png)

Instrumented applications emit events with rich, structured data, and collectors
receive the events. Of course, at compile-time, the instrumented application and
the event collectors do not know about each other. A trait object bridges the
instrumentation half with the collection half enabling collectors to register
themselves dynamically. So, passing rich, structured data from the
instrumentation half to the collector requires passing it through the trait
object boundary. Tracing supports this at a minimal level today but does not
support passing nested data.

Let's look at an actual use case. Given an HTTP service, at the start of an HTTP
request, we want to emit a tracing event that includes relevant HTTP headers.
The data may look something like this.

```javascript=
{
  user_agent: "Mozilla/4.0 (compatible; MSIE5.01; Windows NT)",
  host: "www.example.com",
  content_type: {
    mime: "text/xml",
    charset: "utf-8",
  },
  accept_encoding: ["gzip", "deflate"],
}
```

In the application, a Rust struct stores the headers.

```rust=
struct Headers {
    user_agent: String,
    host: String,
    content_type: ContentType,
    accept_encoding: Vec<String>,
}

struct ContentType {
    mime: String,
    charset: String,
}
```

We want to pass this data to the event collector, but how? The event collector
doesn't know about the `Headers` struct, so we can't just define a method that
takes a `&Headers`. We could use a type like `serde_json::Value` to pass arbitrary
structured data but this would require allocating and copying the data from our
application's struct to hand it to the collector.

The Valuable crate aims to solve this problem. In the HTTP header case, first,
we would implement `Valuable` for our `Headers` type. Then, we can pass a `&dyn
Valuable` reference to the event collector. The collector can use Valuable's
visitor API to inspect the value and extract data relevant to its use case.

```rust=
// Visit the root of the Headers struct. This visitor will find the
// `accept_encoding` field on `Headers` and extract the contents. All other
// fields are ignored.
struct VisitHeaders {
    /// The extracted `accept-encoding` header values.
    accept_encoding: Vec<String>,
}

// Visit the `accept-encoding` `Vec`. This visitor iterates the items in
// the list and pushes it into its `accept_encoding` vector.
struct VisitAcceptEncoding<'a> {
    accept_encoding: &'a mut Vec<String>,
}

impl Visit for VisitHeaders {
    fn visit_value(&mut self, value: Value<'_>) {
        // We expect a `Structable` representing the `Headers` struct.
        match value {
            // Visiting the struct will call `visit_named_fields`.
            Value::Structable(v) => v.visit(self),
            // Ignore other patterns
            _ => {}
        }
    }

    fn visit_named_fields(&mut self, named_values: &NamedValues<'_>) {
        // We only care about `accept_encoding`
        match named_values.get_by_name("accept_encoding") {
            Some(Value::Listable(accept_encoding)) => {
                // Create the `VisitAcceptEncoding` instance to visit
                // the items in `Listable`.
                let mut visit = VisitAcceptEncoding {
                    accept_encoding: &mut self.accept_encoding,
                };
                accept_encoding.visit(&mut visit);
            }
            _ => {}
        }
    }
}

// Extract the "accept-encoding" headers
let mut visit = VisitHeaders { accept_encoding: vec![] };
valuable::visit(&my_headers, &mut visit);

assert_eq!(&["gzip", "deflate"], &visit.accept_encoding[..]);
```

Note how the visitor API lets us pick and choose what data to inspect. We only
care about the `accept_encoding` value, so that is the only field we visit. We
do not visit the `content_type` field.

The Valuable crate represents each value as an instance of the [`Value`
enum][enum]. Primitive rust types are enumerated, and other types are categories
into Structable, Enumerable, Listable, or Mappable represented by traits of the
same name. Implementing a struct or enum traits is usually done using a
procedural macro; however, it might look like this.

```rust=
static FIELDS: &[NamedField<'static>] = &[
    NamedField::new("user_agent"),
    NamedField::new("host"),
    NamedField::new("content_type"),
    NamedField::new("accept_encoding"),
];

impl Valuable for Headers {
    fn as_value(&self) -> Value<'_> {
        Value::Structable(self)
    }

    fn visit(&self, visit: &mut dyn Visit) {
        visit.visit_named_fields(&NamedValues::new(
            FIELDS,
            &[
                Value::String(&self.user_agent),
                Value::String(&self.host),
                Value::Structable(&self.content_type),
                Value::Listable(&self.accept_encoding),
            ]
        ));
    }
}

impl Structable for Headers {
    fn definition(&self) -> StructDef<'_> {
        StructDef::new_static("Headers", Fields::Named(FIELDS))
    }
}
```

Notice how the visit implementation does not copy any data besides primitive
types. If the visitor does not need to inspect sub-fields, no further work is
required.

We expect Valuable to be useful beyond just Tracing. For example, it is helpful
for any serialization when object safety is required. Valuable is not a
replacement for [Serde] and will not provide a deserialization API. However,
Valuable can complement Serde as Serde's serialization API is not [trait-object
safe][object-safe] due to the trait's [associated types][serde-at]
([erased-serde] exists to work around the problem but requires allocating for
each nested data structure). A `valuable-serde` crate is already [in
progress][valuable-serde] (thanks [taiki-e]), providing a bridge between a type
implementing `Valuable` and `Serialize`. To get object-safe serialization,
derive `Valuable` instead of `Serialize` and serialize the `Valuable` trait
object.

As another potential use case, Valuable can efficiently provide data when
rendering templates. A templating engine must access data fields on-demand as it
is rendering a template. For example, the [Handlebars crate][handlebars]
currently uses [`serde_json::Value`][json] as the argument type when rendering,
requiring the caller to copy data into a `serde_json::Value` instance. Instead,
if Handlebars used Valuable, the copying step is skipped.

Now we need you to give [Valuable][crate] a try and let us know if it satisfies
your use cases. Because Tracing 1.0 will depend on Valuable, we hope to
stabilize a 1.0 release of Valuable by early 2022. That does not give us a lot
of time, so we need to find API holes sooner than later. Try to write libraries
using Valuable, especially templating engines or other use cases hinted at by
this post. We could also use help with "bridge" crates (e.g.
[`valuable-http`][http]), that provide Valuable implementations for common
ecosystem data types. There is also a lot of work left to expand the derive
macro with configuration options and other capabilities, so come say hi in the
`#valuable` channel on the [Tokio discord server][discord].

[crate]: https://github.com/tokio-rs/valuable
[trait]: https://github.com/tokio-rs/valuable/blob/588e345c27c0b1b3a3faab93ef8487e1c5db9a9e/valuable/src/valuable.rs
[Tracing]: https://github.com/tokio-rs/tracing
[Console]: https://github.com/tokio-rs/console
[Tokio]: https://github.com/tokio-rs/tokio
[json]: https://docs.rs/serde_json/1.0.64/serde_json/enum.Value.html
[enum]: https://github.com/tokio-rs/valuable/blob/588e345c27c0b1b3a3faab93ef8487e1c5db9a9e/valuable/src/value.rs
[Serde]: https://serde.rs/
[valuable-serde]: https://github.com/tokio-rs/valuable/pull/23
[taiki-e]: https://github.com/taiki-e/
[handlebars]: https://github.com/sunng87/handlebars-rust/tree/0ce070cb6a7816bad4c9083dab075ffd46cbf70d#quick-start
[discord]: https://discord.gg/tokio
[http]: https://github.com/tokio-rs/valuable/issues/45
[object-safe]: https://doc.rust-lang.org/book/ch17-02-trait-objects.html#object-safety-is-required-for-trait-objects
[serde-at]: https://github.com/serde-rs/serde/blob/985725f820a08fbe1c23688422d79200d24502ec/serde/src/ser/mod.rs#L332-L385
[erased-serde]: https://github.com/dtolnay/erased-serde
