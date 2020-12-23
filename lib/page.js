import Content from "../components/content";
import Layout from "../components/layout";

export default function Page({
  app,
  menu,
  page: { next, prev, href, title, body, mdPath },
}) {
  return (
    <>
      <Layout title={title} blog={app.blog}>
        <Content
          href={href}
          title={title}
          menu={menu}
          next={next}
          prev={prev}
          body={body}
          mdPath={mdPath}
        />
      </Layout>
    </>
  );
}
