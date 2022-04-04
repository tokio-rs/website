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

### Getting Started

Tokio website is built using [Docusaurus 2](https://docusaurus.io/), paired with the [Bulma] CSS framework.

First, make sure you have NPM installed. Next, start the development server:

The following command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

```bash
npm start
```

Then, open [http://localhost:3000](http://localhost:3000).

[Next.js]: https://nextjs.org/
[Bulma]: https://bulma.io/

### Resources

To learn more about Docusaurus, take a look at the following resources:

- [Docusaurus Documentation](https://docusaurus.io/docs) - learn about Docusaurus features and API.
- [Bulma documentation](https://bulma.io/documentation/) - learn about Bulma.

## License

This project is licensed under the [MIT license](LICENSE).

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in Tokio by you, shall be licensed as MIT, without any additional
terms or conditions.

You can run our tests by running the commands:
```
# in doc-test
cargo +nightly test

# in tutorial-code
cargo test --all
```
The doc tests verify that all code blocks are valid Rust, and the tutorial-code folder
contains the full code examples from the tutorial.

