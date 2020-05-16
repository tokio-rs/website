import classnames from "classnames";

export default function Libs() {
    const items = [
        {
          id: 'tokio',
          name: 'Tokio Runtime',
          desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.',
        },
        {
          id: 'hyper',
          name: 'Hyper',
          desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.',
        },
        {
          id: 'tonic',
          name: 'Tonic',
          desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec iaculis mauris.',
        },
    ].map(({id, name, desc}) => (
      <div key={id} className={classnames("column", "is-half", "tk-lib", `tk-lib-${id}`)}>
        <div className="card">
          <div className="card-content">
            <div className="media">
              <div className="media-content">
                <h1 className="title is-4">
                <img src={`/img/icons/${id}.svg`} style={{verticalAlign: 'middle'}}/>&nbsp;
                  {name}
                </h1>
              </div>
            </div>
            <div className="content">
              <h2 className="subtitle">{desc}</h2>
            </div>
          </div>
        </div>
      </div>
    ));

  return (
    <>
      <section className="tk-libs">
        <div className="container">
          <div className="columns is-multiline">
            <div className="column is-half">
              <div className="hero is-medium">
                <h1 className="title">Fast. Reliable. Lightweight.</h1>
                <h2 className="subtitle">Building on top of Rust, Tokio provides blazingly fast performance, making it an ideal choice for high performance server applications.</h2>
              </div>
            </div>
            {items}
          </div>
        </div>
      </section>
    </>
  );
}