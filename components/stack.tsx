export default function Stack() {
  const items = [
    {
      id: "stack",
      name: "The Tokio stack",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
    {
      id: "runtime",
      name: "Runtime",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
    {
      id: "hyper",
      name: "Hyper",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
    {
      id: "tonic",
      name: "Tonic",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
    {
      id: "tower",
      name: "Tower",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
    {
      id: "mio",
      name: "Mio",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
    {
      id: "tracing",
      name: "Tracing",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
    {
      id: "bytes",
      name: "Bytes",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
  ].map(({ id, name, desc }) => (
    <div key={id} className="card">
      <div className="card-content">
        <div className="media">
          <div className="media-content">
            <h1 className="title is-4">
              {/* <img src={`/img/icons/${id}.svg`} /> */}
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
              <aside
                className="menu"
                style={{ position: "sticky", top: "80px" }}
              >
                <ul className="menu-list">
                  <li>
                    <a>Tokio</a>
                  </li>
                  <li>
                    <a>Runtime</a>
                  </li>
                  <li>
                    <a>Hyper</a>
                  </li>
                  <li>
                    <a>Tonic</a>
                  </li>
                  <li>
                    <a>Tower</a>
                  </li>
                  <li>
                    <a>Mio</a>
                  </li>
                  <li>
                    <a>Tracing</a>
                  </li>
                  <li>
                    <a>Bytes</a>
                  </li>
                </ul>
              </aside>
            </div>
            <div className="column is-5">{items}</div>
            <div className="column is-half">
              <div
                className="container"
                style={{ position: "sticky", top: "40px" }}
              >
                <img src="/img/stack-all.svg" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
