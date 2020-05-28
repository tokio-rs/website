import * as content from "../../lib/api";
import Page from "../../lib/page";
import util from "util";

const menuSize = 8;

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
  let paths = content.getDateOrderedPaths("blog");

  let years = {};

  let i = 0;
  for (const page of paths) {
    if (i == menuSize) {
      break;
    }

    i += 1;

    delete page.body;

    const date = new Date(page.date);

    const year = date.getFullYear().toString();

    if (!years[year]) {
      years[year] = {
        key: year,
        title: year,
        nested: [],
      };
    }

    years[year].nested.push(page);
  }

  let menu = [];

  for (const [, entry] of Object.entries(years)) {
    menu.push(entry);
  }

  menu.sort((a, b) => b.key - a.key);

  const page = content.loadPage(`blog/${slug}`);

  return content.withAppProps({
    props: {
      page,
      menu,
    },
  });
}
