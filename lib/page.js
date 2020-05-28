import Content from "../components/content";
import Layout from "../components/layout";

export default function Page({ app, menu, page: { href, title, body } }) {
  return (
    <>
      <Layout blog={app.blog}>
        <Content href={href} title={title} menu={menu} body={body} />
      </Layout>
    </>
  );
}
