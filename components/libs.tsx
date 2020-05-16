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
      <div className="column is-half">
        <div className="card">
          <div className="card-content">
            <div className="media">
              <div className="media-left">
                <figure className="image">
                  <img src={`/img/icons/${id}.svg`}/>
                </figure>
              </div>
              <div className="media-content">
                <p className="title is-4">{name}</p>
              </div>
            </div>
            <div className="content">{desc}</div>
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
              <h1>Fast. Reliable. Lightweight.</h1>
              <h2>Building on top of Rust, Tokio provides blazingly fast performance, making it an ideal choice for high performance server applications.</h2>
            </div>
            {items}
          </div>
        </div>
      </section>
    </>
  );
}