import Layout from "../components/layout";

export default function Docs() {
  return (
    <Layout>
      <div className="columns is-marginless tk-docs">
        <div className="column is-one-quarter tk-docs-nav">LEFT</div>
        <div className="column is-three-quarters">
          <section className="section tk-content">
            <h1>What is Tokio?</h1>
            <p>
              Tokio allows developers to write asynchronous programs in the Rust
              programming language. Instead of synchronously waiting for
              long-running operations (like reading a file or waiting for a
              timer to complete) before moving on to the next thing, Tokio
              allows developers to write programs where execution continues
              while the long-running operations are in progress.
            </p>
            <p>
              Tokio allows developers to write asynchronous programs in the Rust
              programming language. Instead of synchronously waiting for
              long-running operations (like reading a file or waiting for a
              timer to complete) before moving on to the next thing, Tokio
              allows developers to write programs where execution continues
              while the long-running operations are in progress.
            </p>
            <p>
              Tokio allows developers to write asynchronous programs in the Rust
              programming language. Instead of synchronously waiting for
              long-running operations (like reading a file or waiting for a
              timer to complete) before moving on to the next thing, Tokio
              allows developers to write programs where execution continues
              while the long-running operations are in progress.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
