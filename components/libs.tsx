import classnames from "classnames";

export default function Libs() {
  const items = [
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
          <code>async</code>/<code>await</code> removes the complexity of
          writing asynchronous applications. Paired with Tokio's utilities and
          vibrant ecosystem, writing applications is a breeze.
        </>
      ),
    },
    {
      id: "tower",
      name: "Flexible",
      desc:
        "The needs of a server application differ from that of an embedded device. Tokio provides the knobs needed to tune it to your use case.",
    },
  ].map(({ id, name, desc }) => (
    <div
      key={id}
      className={classnames(
        "column",
        "is-half",
        "is-flex",
        "tk-lib",
        `tk-lib-${id}`
      )}
    >
      <div className="card">
        <div className="card-content">
          <div className="media">
            <div className="media-content">
              <h1 className="title is-4">{name}</h1>
            </div>
          </div>
          <div className="content">
            <h2 className="subtitle">{desc}</h2>
          </div>
          <p className="learn-more has-text-right">
            <a href="#">Learn more ➔</a>
          </p>
        </div>
      </div>
    </div>
  ));

  return (
    <>
      <section className="tk-features">
        <div className="container">
          <div className="columns is-multiline">{items}</div>
        </div>
      </section>
    </>
  );
}
