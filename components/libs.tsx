import React, { FC, ReactNode } from "react";
import classnames from "classnames";

type Library = {
  id: string;
  name: string;
  desc: ReactNode;
};

const LIBS: Library[] = [
  {
    id: "runtime",
    name: "Reliable",
    desc:
      "Tokio's APIs are memory-safe, thread-safe, and misuse-resistant. This helps prevent common bugs, such as unbounded queues, buffer overflows, and task starvation.",
  },
  {
    id: "hyper",
    name: "Fast",
    desc:
      "Building on top of Rust, Tokio provides a multi-threaded, work-stealing scheduler. Applications can process hundreds of thousands of requests per second with minimal overhead.",
  },
  {
    id: "tonic",
    name: "Easy",
    desc: (
      <>
        <code>async</code>/<code>await</code> reduces the complexity of writing
        asynchronous applications. Paired with Tokio's utilities and vibrant
        ecosystem, writing applications is a breeze.
      </>
    ),
  },
  {
    id: "tower",
    name: "Flexible",
    desc:
      "The needs of a server application differ from that of an embedded device. Although Tokio comes with defaults that work well out of the box, it also provides the knobs needed to fine tune to different cases.",
  },
];

const Lib: FC<{ lib: Library }> = ({ lib }) => (
  <div
    className={classnames(
      "column",
      "is-half",
      "is-flex",
      "tk-lib",
      `tk-lib-${lib.id}`
    )}
  >
    <div className="card">
      <div className="card-content">
        <div className="media">
          <div className="media-content">
            <h1 className="title is-4">{lib.name}</h1>
          </div>
        </div>
        <div className="content">
          <h2 className="subtitle">{lib.desc}</h2>
        </div>
        {/* <p className="learn-more has-text-right">
          <a href="#">Learn more ➔</a>
        </p> */}
      </div>
    </div>
  </div>
);

const Libs: FC = () => (
  <section className="tk-features">
    <div className="container">
      <div className="columns is-multiline">
        {LIBS.map((lib) => (
          <Lib lib={lib} key={lib.id} />
        ))}
      </div>
    </div>
  </section>
);

export default Libs;
