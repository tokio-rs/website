import Content from "../components/content";
import Layout from "../components/layout";

export default function Page({ app, menu, page: { href, title, body } }) {
  const next = {
    href: "#",
    title: "Reducing tail latencies wit...",
  };
  const prev = {
    href: "#",
    title: "Announcing Mio 0.7-alpha.1",
  };
  return (
    <>
      <Layout blog={app.blog}>
        <Content
          href={href}
          title={title}
          menu={menu}
          next={next}
          prev={prev}
          body={body}
        />
      </Layout>
    </>
  );
}
