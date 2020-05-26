import Content from "../components/content";
import Layout from "../components/layout";

export default function Page({ app, slug, title, menu, body }) {
  return (
    <>
      <Layout blog={app.blog}>
        <Content slug={slug} title={title} menu={menu} body={body} />
      </Layout>
    </>
  );
}
