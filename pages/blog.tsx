import Link from "next/link";
import Layout from "../components/layout";
import * as blog from "../lib/blog";
import * as api from "../lib/api";

type Props = {
  app: any;
  // TODO: Properly type the posts
  postsByYear: Record<number, any>;
};

export default function Blog({ app, postsByYear }: Props) {
  return (
    <Layout title={"Blog Posts"} blog={app.blog}>
      <div className="is-marginless tk-docs">
        <div className="columns is-mobile is-centered">
          <div className="column is-half-desktop tk-content">
            <section className="section content">
              <h1 className="title">Blog Posts</h1>
              {Object.entries(postsByYear)
                .reverse()
                .map(([year, { title, nested }]) => (
                  <YearPosts year={year} posts={nested} key={title} />
                ))}
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function YearPosts({ year, posts }) {
  return (
    <div className="blog-year-posts">
      <h2>{year}</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.title}>
            <Link href={post.href}>{post.menuTitle || post.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function getStaticProps() {
  let postsByYear = blog.getBlogPostsByYear();
  return await api.withAppProps({ props: { postsByYear } });
}
