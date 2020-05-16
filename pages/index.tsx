import Layout from '../components/layout'
import Logos from '../components/logos'

export default function Home() {
  return (
    <Layout>
      <section className="hero is-primary tk-intro">
        <div className="hero-body">
          <div className="container has-text-centered">
            <h1 className="title">
              The asynchronous run-time for the Rust programming language
            </h1>
            <h2 className="subtitle">
              Tokio is an open source library providing an asynchronous, event driven platform for
              building fast, reliable, and lightweight network applications. It leverages Rust's
              ownership and concurrency model to ensure thread safety.
            </h2>
            <a className="button">Get Started</a>
          </div>
        </div>
      </section>
      <Logos/>
      <section className="tk-libs">
        <div className="container">
          <div className="columns is-multiline">
            <div className="column is-half">
              <h1>Fast. Reliable. Lightweight.</h1>
              <h2>Building on top of Rust, Tokio provides blazingly fast performance, making it an ideal choice for high performance server applications.</h2>
            </div>

            <div className="column is-half">
              <div className="card">
                <div className="card-content">
                  <div className="media">
                    <div className="media-left">
                      <figure className="image">
                        <img src="/img/icons/tokio.svg" alt="Placeholder image"/>
                      </figure>
                    </div>
                    <div className="media-content">
                      <p className="title is-4">Tokio Runtime</p>
                    </div>
                  </div>
                  <div className="content">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Phasellus nec iaculis mauris. <a>@bulmaio</a>.
                    <a href="#">#css</a> <a href="#">#responsive</a>
                  </div>
                </div>
              </div>
            </div>

            <div className="column is-half">
              <div className="card">
                <div className="card-content">
                  <div className="media">
                    <div className="media-left">
                      <figure className="image">
                        <img src="/img/icons/hyper.svg" alt="Placeholder image"/>
                      </figure>
                    </div>
                    <div className="media-content">
                      <p className="title is-4">Hyper</p>
                    </div>
                  </div>
                  <div className="content">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Phasellus nec iaculis mauris. <a>@bulmaio</a>.
                    <a href="#">#css</a> <a href="#">#responsive</a>
                  </div>
                </div>
              </div>
            </div>

            <div className="column is-half">
              <div className="card">
                <div className="card-content">
                  <div className="media">
                    <div className="media-left">
                      <figure className="image">
                        <img src="/img/icons/tonic.svg" alt="Placeholder image"/>
                      </figure>
                    </div>
                    <div className="media-content">
                      <p className="title is-4">Tonic</p>
                    </div>
                  </div>
                  <div className="content">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Phasellus nec iaculis mauris. <a>@bulmaio</a>.
                    <a href="#">#css</a> <a href="#">#responsive</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  )
}
