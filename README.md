# Tokio Website

The website for the Tokio project. Lives at https://tokio.rs.

Besides containing the content for the website, it also includes crates
containing the example code used in the tutorial. These crates can be compiled
and ran.

* [hello-tokio](tutorial-code/hello-tokio/src/main.rs)
* [spawning](tutorial-code/spawning/src/main.rs)
* [shared-state](tutorial-code/shared-state/src/main.rs)
* [channels](tutorial-code/channels/src/main.rs)
* [io](tutorial-code/io)
    * [echo-server-copy](tutorial-code/io/src/echo-server-copy.rs)
    * [echo-server](tutorial-code/io/src/echo-server.rs)
* [mini-tokio](tutorial-code/mini-tokio/src/main.rs)

## Contributing

Thinking about contributing? Great! This should help you get the website running
locally.

Here are some places you can look for things to solve:

 - [Issues marked help wanted](https://github.com/tokio-rs/website/labels/help%20wanted)
 - [Topic articles](https://github.com/tokio-rs/website/issues/448)
 - [The ecosystem](https://github.com/tokio-rs/website/issues/453)
 - [FAQ](https://github.com/tokio-rs/website/issues/452)

### Getting Started

The website is built using [Next.js] paired with the [Bulma] CSS framework.
First, make sure you have NPM installed. Next, start the development server:

```bash
npm run dev
```

Then, open [http://localhost:3000](http://localhost:3000).

[Next.js]: https://nextjs.org/
[Bulma]: https://bulma.io/

### Resources

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Bulma documentation](https://bulma.io/documentation/) - learn about Bulma.

## License

This project is licensed under the [MIT license](LICENSE).

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in Tokio by you, shall be licensed as MIT, without any additional
terms or conditions.
