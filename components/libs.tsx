import classnames from "classnames";

export default function Libs() {
  const items = [
    {
      id: "runtime",
      name: "Reliable",
      desc:
        "Leveraging Rust's type system, APIs are memory-safe, thread-safe, and misuse-resistant. Tokio helps prevent common bugs, such as unbounded queues and task starvation."
    },
    {
      id: "hyper",
      name: "Fast",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
    {
      id: "tonic",
      name: "Easy",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
    {
      id: "tower",
      name: "Flexible",
      desc:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.",
    },
  ].map(({ id, name, desc }) => (
    <div
      key={id}
      className={classnames("column", "is-half", "tk-lib", `tk-lib-${id}`)}
    >
      <div className="card">
        <div className="card-content">
          <div className="media">
            <div className="media-content">
              <h1 className="title is-4">
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
    </div>
  ));

  return (
    <>
      <section className="tk-features">
        <div className="container">
          <div className="columns is-multiline">
            {items}
          </div>
        </div>
      </section>
    </>
  );
}
