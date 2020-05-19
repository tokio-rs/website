import Layout from "../components/layout";

export default function Doc(frontMatter) {
  return ({ children: content }) => {
      return (
        <Layout>
            <div className="columns is-marginless tk-docs">
                <div className="column is-one-quarter tk-docs-nav">LEFT</div>
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