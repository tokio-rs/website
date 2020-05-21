import { getPaths, getProps } from "../../lib/content";

import Content from "../../components/content";
import Layout from "../../components/layout";

const menu = {
  overview: {},
  "getting-started": {
    title: "Getting Started",
    pages: ["hello-world", "cargo-dependencies", "echo"],
  },
};

export default function Page({ title, menu, body }) {
  return (
    <>
      <Layout>
        <Content title={title} menu={menu} body={body} />]
      </Layout>
    </>
  );
}

export async function getStaticPaths() {
  return getPaths(menu);
}

export async function getStaticProps({ params: { slug }}) {
  return getProps(menu, "docs", slug);
}