import Link from "@docusaurus/Link";
import clsx from "clsx";
import React, { FC } from "react";
// import styles from "./styles.module.scss"
import styles from "./styles.module.scss"

const gettingStarted = "/tokio/tutorial";

const toTitleCase = (string: String) => string.split(' ')
  .map(w => w[0].toUpperCase() + w.substring(1).toLowerCase())
  .join(' ');

const icons = [
  "bytes",
  "hyper",
  "mio",
  "runtime", "runtime2",
  "tonic",
  "tower",
  "tracing",
].map((id) => (
  <div key={id} className={clsx(styles.tkFloat, styles[`tkFloat${toTitleCase(id)}`])}>
    <img src={`/img/icons/${id == "runtime2" ? "runtime" : id}.svg`} />
  </div>
));

const Hero: FC = () => {
  return (
    <div className={clsx(styles.hero, styles.tkIntro)}>
      <div className={styles.heroBody}>
        <div className={clsx(styles.container, styles.tkHeroBg)}>
          {icons}
          <div className={clsx(styles.container)}>
            <h1 className={styles.title}>
              Build reliable network applications without compromising speed.
            </h1>
            <p className={styles.subtitle}>
              Tokio is an asynchronous runtime for the Rust programming language.
              It provides the building blocks needed for writing network
              applications. It gives the flexibility to target a wide range of
              systems, from large servers with dozens of cores to small embedded
              devices.
              {/* Tokio is an open source library providing an asynchronous, event
driven platform for building fast, reliable, and lightweight
network applications. It leverages Rust's ownership and
concurrency model to ensure thread safety. */}
            </p>
            <Link to={gettingStarted}>
              <button className={clsx("button", "button--lg", styles.button)}>
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </div></div>
  )
};

export default Hero;
