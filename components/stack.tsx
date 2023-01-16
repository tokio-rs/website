import React, { FC, useEffect } from "react";
import classnames from "classnames";

type StackLayer = {
  id: string;
  short?: string;
  name: string;
  desc: string;
  zIndex: number;
  href?: string;
};

const STACK_LAYERS: StackLayer[] = [
  {
    id: "tokio",
    short: "Stack",
    name: "The stack",
    desc: "Applications aren't built in a vacuum. The Tokio stack includes everything needed to ship to production, fast.",
    zIndex: 0,
  },
  {
    id: "runtime",
    name: "Runtime",
    desc: "Including I/O, timer, filesystem, synchronization, and scheduling facilities, the Tokio runtime is the foundation of asynchronous applications.",
    zIndex: 3,
    href: "/tokio/tutorial",
  },
  {
    id: "hyper",
    name: "Hyper",
    desc: "An HTTP client and server library supporting both the HTTP 1 and 2 protocols.",
    zIndex: 4,
    href: "https://github.com/hyperium/hyper",
  },
  {
    id: "tonic",
    name: "Tonic",
    desc: "A boilerplate-free gRPC client and server library. The easiest way to expose and consume an API over the network.",
    zIndex: 6,
    href: "https://github.com/hyperium/tonic",
  },
  {
    id: "tower",
    name: "Tower",
    desc: "Modular components for building reliable clients and servers. Includes retry, load-balancing, filtering, request-limiting facilities, and more.",
    zIndex: 5,
    href: "https://github.com/tower-rs/tower",
  },
  {
    id: "mio",
    name: "Mio",
    desc: "Minimal portable API on top of the operating-system's evented I/O API.",
    zIndex: 2,
    href: "https://github.com/tokio-rs/mio",
  },
  {
    id: "tracing",
    name: "Tracing",
    desc: "Unified insight into the application and libraries. Provides structured, event-based, data collection and logging.",
    zIndex: 0,
    href: "https://github.com/tokio-rs/tracing",
  },
  {
    id: "bytes",
    name: "Bytes",
    desc: "At the core, networking applications manipulate byte streams. Bytes provides a rich set of utilities for manipulating byte arrays.",
    zIndex: 1,
    href: "https://github.com/tokio-rs/bytes",
  },
];

const Menu: FC = () => (
  <div className="column is-1 tk-menu is-hidden-touch">
    <div className="container anchor">
      <aside className="menu">
        <ul className="menu-list">
          {STACK_LAYERS.map((layer) => (
            <li key={layer.id} className={`tk-lib-${layer.id}`}>
              <a href={`#tk-lib-${layer.id}`}>{layer.short || layer.name}</a>{" "}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  </div>
);

const Layer: FC<{ layer: StackLayer }> = ({ layer }) => (
  <div className="card">
    <div
      id={"tk-lib-stack-" + layer.id}
      className={classnames("card-content", `tk-lib-${layer.id}`)}
    >
      <div className="media">
        <div className="media-content">
          <a
            id={`tk-lib-${layer.id}`}
            style={{
              display: "block",
              position: "relative",
              top: "-40vh",
              visibility: "hidden",
            }}
          />
          <h1 className="title is-4">
            <img src={`/img/icons/${layer.id}.svg`} alt={layer.name} />
            {layer.name}
          </h1>
        </div>
      </div>
      <div className="content">
        <h2 className="subtitle">{layer.desc}</h2>
        {layer.href && (
          <p className="learn-more has-text-right">
            <a href={layer.href}>Learn more ➔</a>
          </p>
        )}
      </div>
    </div>
  </div>
);

export default function Stack() {
  useEffect(() => {
    var stack = document.getElementsByClassName(
      "tk-stack-active"
    ) as HTMLCollectionOf<HTMLElement>;
    var links = document.querySelectorAll(".tk-stack .menu li");
    var lines = document.getElementById("tk-stack-lines");

    // Done in JS so that when JS is not enabled, no links are enabled.
    links[0].classList.add("is-active");

    var stackElems = [];
    for (var i = 0; i < stack.length; ++i) {
      var stackId = stack[i].dataset.stackId;
      var div = document.getElementById("tk-lib-stack-" + stackId);
      // The boolean stores whether it is currently opaque.
      stackElems.push([stack[i], div, true]);
    }

    if (stackElems.length > 0) {
      var fn = function () {
        onscrollUpdateStacks(stackElems, links, lines);
      };
      window.addEventListener("scroll", fn);
      window.addEventListener("resize", fn);
      setTimeout(fn);
    }
  }, []);
  return (
    <section className="tk-stack">
      <div className="container">
        <div className="columns">
          <Menu />

          <div className="column is-5-desktop is-half-tablet tk-libs">
            {STACK_LAYERS.map((l) => (
              <Layer layer={l} key={l.id} />
            ))}
          </div>

          <div className="column is-half is-hidden-mobile">
            <div className="container anchor">
              {STACK_LAYERS.slice(1).map(({ id, zIndex }) => (
                <img
                  key={id}
                  className="tk-stack-active"
                  data-stack-id={id}
                  src={"/img/stack-" + id + ".svg"}
                  style={{ zIndex: zIndex }}
                />
              ))}
              {/* Special handling */}
              <img
                id="tk-stack-lines"
                data-stack-id="lines"
                src="/img/stack-lines.svg"
                style={{ zIndex: 7 }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function onscrollUpdateStacks(stackElems, links, lines) {
  var i;
  var stackBox = stackElems[0][0].getBoundingClientRect();
  var stackMid = (stackBox.top + 3 * stackBox.bottom) / 4.0;

  var current = -1;
  var currentY = -Infinity;
  // Find the thing to highlight.
  for (i = 0; i < stackElems.length; ++i) {
    var divBox = stackElems[i][1].getBoundingClientRect();
    // We want to highlight it if the div is sufficiently far down compared
    // to the floating stack image.
    if (divBox.top < stackMid) {
      // And among those, we want the top one.
      if (currentY < divBox.top) {
        current = i;
        currentY = divBox.top;
      }
    }
  }

  var didUpdate = false;

  for (i = 0; i < stackElems.length; ++i) {
    // Update the elements that don't have the correct state already.
    var shouldBeOpaque = current == -1 || current == i;
    if (stackElems[i][2] == shouldBeOpaque) continue;

    stackElems[i][2] = shouldBeOpaque;

    if (shouldBeOpaque) {
      didUpdate = true;
      stackElems[i][0].classList.add("tk-stack-active");
    } else {
      didUpdate = true;
      stackElems[i][0].classList.remove("tk-stack-active");
    }
  }

  if (didUpdate) {
    for (let i = 0; i < links.length; ++i) {
      links[i].classList.remove("is-active");
    }

    links[current + 1].classList.add("is-active");

    if (current != -1 && stackElems[current][0].dataset.stackId == "tracing") {
      lines.classList.add("tk-stack-active");
    } else {
      lines.classList.remove("tk-stack-active");
    }
  }
}
