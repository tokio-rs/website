import Content from "../components/content";
import Layout from "../components/layout";

export default function Page({ app, title, menu, body }) {
  return (
    <>
      <Layout blog={app.blog}>
        <Content title={title} menu={menu} body={body} />
      </Layout>
    </>
  );
}
