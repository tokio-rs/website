import classnames from "classnames";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";

import styles from "./nav.module.scss";

export default function Navigation() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <nav className="navbar" role="navigation" aria-label="main navigation">
        <div className="container">
          <div className="navbar-brand">
            <Brand />
            <a
              role="button"
              className={classnames("navbar-burger", {
                "is-active": expanded,
              })}
              aria-label="menu"
              aria-expanded="false"
              onClick={() => setExpanded(!expanded)}
            >
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
            </a>
          </div>
          <div
            className={classnames("navbar-menu", {
              "is-active": expanded,
            })}
          >
            <div className="navbar-end">
              <Docs />

              <hr
                className={classnames(
                  "has-text-light",
                  "has-background-light",
                  "is-hidden-touch",
                  styles.divider
                )}
              />

              <SocialLinks />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

function Brand() {
  return (
    <Link href="/">
      <a className="navbar-item">
        <img src="/img/tokio-horizontal.svg" width="133" height="56" />
      </a>
    </Link>
  );
}

function Docs() {
  const items = ["Libraries", "Docs", "Community"].map((txt) => (
    <a key={txt} className={classnames("navbar-item", styles.spacing)}>{txt}</a>
  ));

  return (
    <>
      {items}
    </>
  );
}

function SocialLinks() {
  return (
    <>
      <a className="navbar-item" href="https://twitter.com/tokio_rs">
        <span className="icon">
          <FontAwesomeIcon icon={["fab", "twitter"]} />
        </span>
      </a>
      <a className="navbar-item" href="https://github.com/tokio-rs/tokio">
        <span className="icon">
          <FontAwesomeIcon icon={["fab", "github"]} />{" "}
        </span>
      </a>
      <a className="navbar-item" href="https://discord.gg/tokio">
        <span className="icon">
          <FontAwesomeIcon icon={["fab", "discord"]} />
        </span>
      </a>
    </>
  );
}
