import React, { FC } from 'react';

const gettingStarted = "/docs/overview";

const Hero: FC = () => (
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
)

export default Hero;