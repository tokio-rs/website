/*
 * Generates pages from markdown content located in the `content` directory.
 */
import Layout from "../components/layout";
import content from "../src/content"


export async function getStaticPaths() {
  const paths = content.getPaths().map((path) => {
    return {
      params: {
        page: path,
      }
    };
  });

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  // Fetch necessary data for the blog post using params.id
  // const postData = params.page.join("/");

  const rendered = await content.getData(params.page);

  return {
    props: {
      postData: rendered,
    }
  }
}

export default function Page({ postData }) {
  return (
    <Layout>
      <div className="columns is-marginless tk-docs">
        <div className="column is-one-quarter tk-docs-nav">LEFT</div>
        <div className="column is-three-quarters">
          <section className="section tk-content" dangerouslySetInnerHTML={{ __html: postData.html }}>
          </section>
        </div>
      </div>
    </Layout>
  );
}