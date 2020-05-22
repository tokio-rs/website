import classnames from "classnames";
import Link from "next/link";
import { GitHub, Twitter, Discord } from "./icons";
import { useState } from "react";

export default function Navigation({ blog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <nav
        className="navbar is-spaced"
        role="navigation"
        aria-label="main navigation"
      >
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
              <Links blog={blog} />
              <hr className="is-hidden-touch" />
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

function Links({ blog }) {
  const links = Object.entries({
    Docs: "/docs/overview",
    // Community: "#",
    Blog: blog.href,
  }).map(([name, href]) => (
    <a key={name} href={href} className="navbar-item navbar-text">
      {name}
    </a>
  ));

  return <>{links}</>;
}

function SocialLinks() {
  return (
    <>
      <a
        className="navbar-item navbar-icon"
        href="https://twitter.com/tokio_rs"
      >
        <span className="icon">
          <Twitter />
        </span>
      </a>
      <a
        className="navbar-item navbar-icon"
        href="https://github.com/tokio-rs/tokio"
      >
        <span className="icon">
          <GitHub />
        </span>
      </a>
      <a className="navbar-item navbar-icon" href="https://discord.gg/tokio">
        <span className="icon">
          <Discord />
        </span>
      </a>
    </>
  );
}
