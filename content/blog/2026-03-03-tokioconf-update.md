---
date: "2026-03-03"
title: "TokioConf Update: What to Expect"
description: "March 3, 2026"
---

We're about seven weeks out from [TokioConf 2026][tokioconf] and most of the big planning decisions are behind us. The [program] is set, including a [workshop] (somehow, I convinced Alice and Sean to do the workshop with me), the venue, A/V, and social events are figured out. A big thanks to Tiffanie who is doing most of the conference organizing.

* **When**: April 20-22, 2026
* **Where**: Portland, OR
* **What**: Two days of talks from people building with Tokio sharing what they learned, a workshop, and social events.

Since we [announced the program and tickets][jan-announcement] in January, I've been getting similar questions. So, I wanted to write a post that addresses those questions directly, and also explain some of the thinking behind the decisions we've made. A lot of what makes TokioConf different isn't obvious from just looking at the website and I probably haven't done a good job at explaining it yet.

## "Is this just for Tokio core contributors?"

No. The program was selected for people who *use* Tokio, not just people who work on it. We specifically asked the program committee to prioritize talks where you walk away with something practical to use in your daily work. Adoption stories, production debugging techniques, performance patterns, architectural decisions. If you have a tokio dependency in your Cargo.toml and you're shipping something with it, this conference is for you. A big thanks to [Armin Ronacher][armin], [Jon Gjengset][jon], [Conrad Ludgate][conrad], [Marc Bowes][marc], [Sean McArthur][sean], and [Alice Ryhl][alice] for their time putting together this pretty incredible program.

That said, the people who *do* work on Tokio will be there and accessible. Alice, Sean, and I are running the [Monday workshop][workshop], and we'll be around for the rest of the conference. [Lucio][lucio] of [Tonic], [David][david] of [Axum], and other core contributors will be there as well. This will be a great chance to get maintainers and users together in the same room, not just to talk code issues, but to build relationships beyond impersonal GitHub commits (sometimes, it is easy to forget there is a human on the other end of the GitHub issue).

## "How is this different from other Rust conferences?"

There are several great Rust conferences going on this year. Those are fantastic events and I'd encourage anyone in the Rust community to attend them. Unlike these conferences which cover the Rust ecosystem as a whole, the entire focus of TokioConf is to go deep on one specific area, network programming. This gives us the ability to get in the weeds to talk about how to instrument your Tokio runtime to find that one task blocking the executor. How to reason about async Rust cancellation semantics. What your peers are doing to deploy new services with minimal downtime. These topics are often too detailed for a general conference.

The hallway track works the same way. Everyone there has been dealing with the same problems, so during the breaks you can get straight to comparing notes instead of seeking out the subset of folks from a larger audience.

## "Why is it so expensive?"

Fair question. TokioConf isn't trying to turn a profit. The price reflects what it actually costs to run a conference (you don’t even want to know how much WiFi alone costs). That said, we don't want cost to be a barrier. 

After running the numbers, we’re able to get more community members to join us in person but we need your help. For every ticket sold between now and the end of March, we'll make another ticket available in the [Community Access tickets][tickets] pool. These tickets are available to anyone in our Tokio Community who wants to attend but for whom the regular price isn’t feasible.

The March deadline is roughly when our venue and vendor commitments come due, after that point we lose the flexibility. So if you've been on the fence, buying sooner directly helps someone else get to come too (and helps reduce Tiffanie’s stress levels).

There's more coming soon on how we're working to make TokioConf accessible to the broader community.

## The social side

I want to talk about this because I think it's actually one of the most important parts of the event, and it's the part that's hardest to convey on a website. Some of the most useful things I've gotten from conferences were from those conversations. Someone mentions an approach to connection pooling you hadn't considered. You hear about a crate you didn't know existed. Someone explains why an API works the way it does and suddenly something clicks. That stuff doesn't happen remotely over GitHub.

We've tried to keep the social side as low-friction as possible. Monday afternoon we have some organized activities if you want to explore the city. I've seen other Rust conferences do this, and I think it is a great idea. We currently have a guided Portland coffee tour — four cafés in one caffeinated afternoon. And we're working on a few more outings as well, so keep an eye out. Monday night there's a private dinner at [Tusk] (and possibly another if Tusk sells out) — no need to coordinate a group, get a reservation, or split the bill. Tuesday night is a social event for everyone at a Portland food cart pod with food and drinks provided.

We're also setting aside space for people who want to hack on things together — bring a side project, pair on something, or just sit near other people writing Rust.

## See you there

[Tickets][tickets] are available. If you have questions about anything — the event, the workshop, travel, whatever — reach out at [hello@tokioconf.com][email] or in the [#tokioconf channel on Discord][Discord]. Sign up for email updates at [tokioconf], or follow us on [Bluesky] or [Mastodon] for announcements.

See you in Portland.

<div style="text-align:right">&mdash;<a href="https://github.com/carllerche">Carl Lerche</a></div>

[program]: https://www.tokioconf.com/schedule/?utm_source=tokio&utm_medium=referral&utm_campaign=noregrets
[tickets]: https://www.eventbrite.com/e/tokioconf-2026-tickets-1595919270499?aff=tokioBlognoregrets
[workshop]: https://www.tokioconf.com/workshop/?utm_source=tokio&utm_medium=referral&utm_campaign=noregrets
[jan-announcement]: https://tokio.rs/blog/2026-01-12-tokio-conf-program
[Tusk]: http://tuskpdx.com/
[Discord]: https://discord.gg/tokio
[Bluesky]: https://bsky.app/profile/tokioconf.com
[Mastodon]: https://hachyderm.io/@tokioconf
[x]: https://x.com/TokioConf
[email]: mailto:hello@tokioconf.com
[armin]: https://github.com/mitsuhiko
[jon]: https://github.com/jonhoo
[conrad]: https://github.com/conradludgate/
[marc]: https://github.com/marcbowes
[sean]: https://github.com/seanmonstar
[alice]: https://github.com/Darksonn
[lucio]: https://github.com/luciofranco
[david]: https://github.com/davidpdrsn
[Tonic]: https://github.com/hyperium/tonic
[Axum]: https://github.com/tokio-rs/axum
[tokioconf]: https://tokioconf.com/?utm_source=tokio&utm_medium=referral&utm_campaign=noregrets
