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
        <a href={docs} target="_blank">Docs</a>
      </p>
      <p>
        <a href={github} target="_blank">Github</a>
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
                <a href="https://github.com/tokio-rs/tokio/discussions" target="_blank">
                  <GitHubIcon className="is-medium" />
                </a>
                <a href="https://discord.gg/tokio" target="_blank">
                  <DiscordIcon className="is-medium" />
                </a>
              </p>
              <p>
                Stay up to date:
                <a href="https://twitter.com/tokio_rs" target="_blank">
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
        <div className="container has-text-centered">
          <p>
            Built with all the love in the world by{" "}
            <a
              href="https://twitter.com/carllerche"
              target="_blank"
              rel="noopener"
            >
              @carllerche
            </a>
          </p>
        </div>
        <div className="container has-text-centered">
          <p>
            with the help of{" "}
            <a href="https://github.com/tokio-rs/tokio/graphs/contributors" target="_blank">
              our contributors
            </a>
            .
          </p>
        </div>
        <div className="container has-text-centered">
          <p>
            Hosted by{" "}
            <a href="https://netlify.com"  target="_blank" rel="sponsored nofollow">
              Netlify
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
