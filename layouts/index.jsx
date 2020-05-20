import Layout from "../components/layout";

export default function Doc(frontMatter) {
  return ({ children: content }) => {
      return (
        <Layout>
            <div className="columns is-marginless tk-docs">
                <div className="column is-one-quarter tk-docs-nav" style={{padding: "4rem 0 0 1rem"}}>

                    <aside className="menu" style={{position: "sticky", top: "4rem", maxWidth: "250px", marginLeft: "auto"}}>
                        <p className="menu-label">
                            Tokio
                        </p>
                        <ul className="menu-list">
                            <li><a>Overview</a></li>
                            <li>
                            <a className="is-active">Getting Started</a>
                            <ul>
                                <li><a>Hello world!</a></li>
                                <li><a>Cargo dependencies</a></li>
                                <li><a>Example: An Echo Server</a></li>
                            </ul>
                            </li>
                            <li><a>Going Deeper</a></li>
                            <li><a>I/O</a></li>
                            <li><a>Internals</a></li>
                        </ul>
                        <p className="menu-label">
                            <img src="/img/left-arrow.svg" style={{ display: "inline-block", verticalAlign: "middle", height: "0.8rem", marginRight: "0.5rem"}}/>
                            <a>All Libraries</a>
                        </p>
                    </aside>

                </div>
                <div className="column is-three-quarters">
                <section className="section content tk-content">
                    <h1 className="title">{frontMatter.title}</h1>
                    {content}
                </section>
                </div>
            </div>
        </Layout>
      );
  };
}