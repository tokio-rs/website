import fs from "fs";
import path from "path";
import matter from "gray-matter";
import remark from "remark";
import html from "remark-html";

import Content from "../components/content";
import Layout from "../components/layout";

const siteMap = {
  docs: {
    overview: {},
    "getting-started": {
      title: "Getting Started",
      pages: ["hello-world", "cargo-dependencies", "echo"],
    },
  },
};

const contentDir = path.join(process.cwd(), "content");

export default function Page({ menu, body, meta: { title } }) {
  return (
    <>
      <Layout>
        <Content title={title} menu={menu} body={body} />]
      </Layout>
    </>
  );
}

export async function getStaticPaths() {
  let paths = collectPaths().map((slug) => {
    [, ...slug] = slug.split("/");

    return {
      params: { slug },
    };
  });

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const [base] = params.slug;
  const page = loadPage(params.slug.join(path.sep));

  // Get the sub-menu for the current page.
  const menu = normalize(siteMap[base], base);

  // Use remark to convert markdown into HTML string
  const processedContent = await remark().use(html).process(page.content);

  const contentHtml = processedContent.toString();

  return {
    props: {
      slug: params.slug,
      body: contentHtml,
      menu,
      meta: page.data,
    },
  };
}

// Build a list of paths from the sitemap
function collectPaths(level = siteMap, prefix = "") {
  let out = [];

  for (const [k, v] of Object.entries(level)) {
    if (Object.keys(v).length == 0) {
      out.push(`${prefix}/${k}`);
    } else if ("title" in v && "pages" in v) {
      for (const [, p] of v.pages.entries()) {
        out.push(`${prefix}/${k}/${p}`);
      }
    } else {
      out = out.concat(collectPaths(v, `/${k}`));
    }
  }

  return out;
}

// Normalize the sitemap using front matter
function normalize(menu, root) {
  let out = {};

  // Level 1 of menu may be single pages or contain a sub structure
  for (const l1 of Object.keys(menu)) {
    if (!menu[l1].pages) {
      // Single page
      const base = `${root}/${l1}`;
      const page = loadPage(base).data;

      out[l1] = {
        key: l1,
        title: page.title,
        href: `/${base}`,
      };
    } else {
      // Load front matter for sub pages
      let submenu = {};

      for (const l2 of menu[l1].pages) {
        const base = `${root}/${l1}/${l2}`;
        const page = loadPage(base).data;

        submenu[l2] = {
          key: l2,
          title: page.title,
          href: `/${base}`,
        };
      }

      out[l1] = {
        key: l1,
        title: menu[l1].title,
        pages: submenu,
      };
    }
  }

  return out;
}

function loadPage(path) {
  const fullPath = `${contentDir}/${path}.md`;

  const fileContents = fs.readFileSync(fullPath, "utf-8");

  // Use gray-matter to parse the post metadata section
  return matter(fileContents);
}
