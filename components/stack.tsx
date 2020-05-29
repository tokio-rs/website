import React, { FC } from "react";
import classnames from "classnames";

type StackLayer = {
  id: string;
  short?: string;
  name: string;
  desc: string;
};

const PLACEHOLDER =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

const STACK_SVG_IDS: string[] = [
  "tracing",
  "bytes",
  "mio",
  "runtime",
  "hyper",
  "tower",
  "tonic",
];

const STACK_LAYERS: StackLayer[] = [
  {
    id: "tokio",
    short: "Stack",
    name: "The stack",
    desc: PLACEHOLDER,
  },
  {
    id: "runtime",
    name: "Runtime",
    desc: PLACEHOLDER,
  },
  {
    id: "hyper",
    name: "Hyper",
    desc: PLACEHOLDER,
  },
  {
    id: "tonic",
    name: "Tonic",
    desc: PLACEHOLDER,
  },
  {
    id: "tower",
    name: "Tower",
    desc: PLACEHOLDER,
  },
  {
    id: "mio",
    name: "Mio",
    desc: PLACEHOLDER,
  },
  {
    id: "tracing",
    name: "Tracing",
    desc: PLACEHOLDER,
  },
  {
    id: "bytes",
    name: "Bytes",
    desc: PLACEHOLDER,
  },
];

const Menu: FC = () => (
  <div className="column is-1 tk-menu">
    <div className="container anchor">
      <aside className="menu wut">
        <ul className="menu-list">
          {STACK_LAYERS.map((layer) => (
            <li key={layer.id}>
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
              top: "-13rem",
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
        <p className="learn-more has-text-right">
          <a href="#">Learn more ➔</a>
        </p>
      </div>
    </div>
  </div>
);

export default function Stack() {
  return (
    <section className="tk-stack">
      <div className="container">
        <div className="columns">
          <Menu />

          <div className="column is-5 tk-libs">
            {STACK_LAYERS.map((l) => (
              <Layer layer={l} key={l.id} />
            ))}
          </div>

          <div className="column is-half">
            <div className="container anchor">
              {STACK_SVG_IDS.map((id) => (
                <img
                  key={id}
                  className="tk-stack-active"
                  data-stack-id={id}
                  src={"/img/stack-" + id + ".svg"}
                />
              ))}
              {/* Special handling */}
              <img
                id="tk-stack-lines"
                data-stack-id="lines"
                src="/img/stack-lines.svg"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
