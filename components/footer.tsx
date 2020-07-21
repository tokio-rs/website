import React from "react";
import { DiscordIcon, GitHubIcon, TwitterIcon } from "./icons";

export default function Footer() {
  const libs = [
    ["Tokio", "/tokio/tutorial", "https://github.com/tokio-rs/tokio"],
    ["Hyper", "https://docs.rs/hyper", "https://github.com/hyperium/hyper"],
    ["Tonic", "https://docs.rs/tonic", "https://github.com/hyperium/tonic"],
    ["Tower", "https://docs.rs/tower", "https://github.com/tower-rs/tower"],
    ["Mio", "https://docs.rs/mio", "https://github.com/tokio-rs/mio"],
    [
      "Tracing",
      "https://docs.rs/tracing",
      "https://github.com/tokio-rs/tracing",
    ],
  ].map(([name, docs, github]) => (
    <div key={name} className="column is-one-third">
      <p className="tk-lib-name">{name}</p>
      <p>
        <a href={docs}>Docs</a>
      </p>
      <p>
        <a href={github}>Github</a>
      </p>
    </div>
  ));
  return (
    <footer className="footer">
      <div className="container">
        <div className="columns">
          <div className="column is-half tk-help is-hidden-mobile">
            <img
              src="/img/tokio-horizontal.svg"
              alt="tokio-logo"
              width="133"
              height="56"
            />
            <div className="tk-help-links">
              <p>
                Get Help:
                <a href="https://github.com/tokio-rs/tokio/discussions">
                  <GitHubIcon className="is-medium" />
                </a>
                <a href="https://discord.gg/tokio">
                  <DiscordIcon className="is-medium" />
                </a>
              </p>
              <p>
                Stay up to date:
                <a href="https://twitter.com/tokio_rs">
                  <TwitterIcon className="is-medium" />
                </a>
              </p>
            </div>
          </div>
          <div className="column is-half">
            <div className="columns is-multiline is-mobile tk-footer-libs">
              {libs}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
