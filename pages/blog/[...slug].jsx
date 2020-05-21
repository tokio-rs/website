import { getDateOrderedPaths, getProps } from "../../lib/content";

import Content from "../../components/content";
import Layout from "../../components/layout";

const menuSize = 10;

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
    const paths = getDateOrderedPaths("blog").map((page) => {
        return {
            params: { slug: [ page.key ]},
        };
    });

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params: { slug }}) {
    const paths = getDateOrderedPaths("blog");

    let menu = {};

    let i = 0;
    for (const page of paths) {
        if (i == menuSize) {
            break;
        }

        i += 1;

        console.debug(page);
        menu[page.key] = page;
    }

    console.debug(menu);

  return getProps(menu, "blog", slug);
}