import classnames from "classnames";

export default function Stack() {
  const data = [
    {
      id: "tokio",
      short: "Stack",
      name: "The stack",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
      id: "runtime",
      name: "Runtime",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
      id: "hyper",
      name: "Hyper",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
      id: "tonic",
      name: "Tonic",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
      id: "tower",
      name: "Tower",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
      id: "mio",
      name: "Mio",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
      id: "tracing",
      name: "Tracing",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
      id: "bytes",
      name: "Bytes",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
  ];

  const menu = data.map(({ id, short, name }) => (
    <li key={id}>
      <a>{short || name}</a>
    </li>
  ));

  const items = data.map(({ id, name, desc }) => (
    <div key={id} className="card">
      <div className={classnames("card-content", `tk-lib-${id}`)}>
        <div className="media">
          <div className="media-content">
            <h1 className="title is-4">
              <img src={`/img/icons/${id}.svg`} />
              {name}
            </h1>
          </div>
        </div>
        <div className="content">
          <h2 className="subtitle">{desc}</h2>
          <p className="learn-more has-text-right">
            <a href="#">Learn more ➔</a>
          </p>
        </div>
      </div>
    </div>
  ));

  return (
    <>
      <section className="tk-stack">
        <div className="container">
          <div className="columns">
            <div className="column is-1 tk-menu">
              <div className="container anchor">
                <aside className="menu">
                  <ul className="menu-list">{menu}</ul>
                </aside>
              </div>
            </div>
            <div className="column is-5 tk-libs">{items}</div>
            <div className="column is-half">
              <div className="container anchor">
                <img src="/img/stack-all.svg" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
