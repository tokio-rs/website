import * as content from "../../lib/api";
import Page from "../../lib/page";

const menuSize = 10;

export default Page;

export async function getStaticPaths() {
  const paths = content.getDateOrderedPaths("blog").map((page) => {
    return {
      params: { slug: [page.key] },
    };
  });

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params: { slug } }) {
  const paths = content.getDateOrderedPaths("blog");

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

  return content.getProps(menu, "blog", slug);
}
