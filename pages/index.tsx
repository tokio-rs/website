import Layout from "../components/layout";
import Footer from "../components/footer";
import Libs from "../components/libs";
import Logos from "../components/logos";
import Stack from "../components/stack";
import * as api from "../lib/api";

const gettingStarted = "/docs/overview";

export default function Home({ app }) {
  return (
    <Layout blog={app.blog}>
      <div className="tk-landing">
        <section className="hero is-primary tk-intro">
          <div className="hero-body">
            <div className="container has-text-centered">
              <h1 className="title">
                Build reliable network applications without compromising speed.
              </h1>
              <h2 className="subtitle">
                Tokio is an asynchronous runtime for the Rust programming
                language. It provides the building blocks needed for writing
                network applications. It gives the flexibility to target a wide
                range of systems, from large servers with dozens of cores to
                small embedded devices.
                {/* Tokio is an open source library providing an asynchronous, event
                driven platform for building fast, reliable, and lightweight
                network applications. It leverages Rust's ownership and
                concurrency model to ensure thread safety. */}
              </h2>
              <a href={gettingStarted} className="button is-link is-medium">
                Get Started
              </a>
            </div>
          </div>
        </section>
        <Logos />
        <Libs />
        <Stack />
      </div>
      <Footer />
    </Layout>
  );
}

export async function getStaticProps() {
  return await api.withAppProps();
}
