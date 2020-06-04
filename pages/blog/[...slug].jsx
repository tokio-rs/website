import * as content from "../../lib/api";
import Page from "../../lib/page";

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

  const page = content.loadPage(`blog/${slug}`);
  let didSee = false;

  let i = 0;
  for (const p of paths) {
    if (i == menuSize) {
      break;
    }

    i += 1;

    delete p.body;

    if (p.href == page.href) {
      didSee = true;
    } else if (!didSee) {
      page.next = {
        title: p.menuTitle || p.title,
        href: p.href,
      };
    } else if (!page.prev) {
      page.prev = {
        title: p.menuTitle || p.title,
        href: p.href,
      };
    }

    const date = new Date(p.date);

    const year = date.getFullYear().toString();

    if (!years[year]) {
      years[year] = {
        key: year,
        title: year,
        nested: [],
      };
    }

    years[year].nested.push({ page: p });
  }

  let menu = [];

  for (const [, entry] of Object.entries(years)) {
    menu.push(entry);
  }

  menu.sort((a, b) => b.key - a.key);

  return content.withAppProps({
    props: {
      page,
      menu,
    },
  });
}
