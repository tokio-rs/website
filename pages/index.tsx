import Layout from '../components/layout'

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
      <section className="hero tk-users">
        <div className="hero-body ">
          <div className="container has-text-centered">
            <h1 className="title">
              Built by the community, for the community.
            </h1>
            <nav className="container columns is-multiline is-centered is-vcentered">
              <div className="column is-3"><a href="#"><img src="/img/logos/linkerd.svg" /></a></div>
              <div className="column is-3"><img src="/img/logos/azure.svg" /></div>
              <div className="column is-3"><img src="/img/logos/pingcap.svg" /></div>
              <div className="column is-3"><img src="/img/logos/comcast.svg" /></div>
              <div className="column is-3"><img src="/img/logos/dropbox.svg" /></div>
              <div className="column is-3"><img src="/img/logos/facebook.svg" /></div>
              <div className="column is-3"><img src="/img/logos/smart-things.svg" /></div>
              <div className="column is-3"><img src="/img/logos/one-signal.svg" /></div>
            </nav>
          </div>
        </div>
      </section>
    </Layout>
  )
}
