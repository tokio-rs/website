import fs from "fs";
import path from "path";
import matter from "gray-matter";
import remark from "remark";
import html from "remark-html";

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

export default function Page({ menu, html, meta: { title } }) {
  return (
    <>
        <Layout>
            <div className="columns is-marginless tk-docs">
                <div className="column is-one-quarter tk-docs-nav" style={{padding: "4rem 0 0 1rem"}}>

                    <aside className="menu" style={{position: "sticky", top: "4rem", maxWidth: "250px", marginLeft: "auto"}}>
                        <p className="menu-label">
                            Tokio
                        </p>
                        <ul className="menu-list">

                        {pagesFor(menu).map((page) => {
                          const hasChildren = page.pages !== undefined;

                          console.log("key", page.key);

                          return (
                            <>
                              <li key={page.key}>
                                <a href={page.href}>{titleFor(page)}</a>
                                {hasChildren && (
                                  <>
                                    <ul>
                                      {pagesFor(page.pages).map((page) => {
                                        console.debug("KEY", page.key);
                                        return (
                                            <>
                                                <li key={page.key}>
                                                    <a href={page.href}>{page.title}</a>
                                                </li>
                                            </>
                                        );
                                      })}
                                    </ul>
                                  </>
                                )}
                              </li>
                            </>
                          );
                        })}

                        </ul>
                        <p className="menu-label">
                            <img src="/img/left-arrow.svg" style={{ display: "inline-block", verticalAlign: "middle", height: "0.8rem", marginRight: "0.5rem"}}/>
                            <a>All Libraries</a>
                        </p>
                    </aside>

                </div>
                <div className="column is-three-quarters">
                <section className="section content tk-content">
                    <h1 className="title">{title}</h1>
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                </section>
                </div>
            </div>
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
  const [base,] = params.slug;
  const page = loadPage(params.slug.join(path.sep))

  // Get the sub-menu for the current page.
  const menu = normalize(siteMap[base], base);

  // Use remark to convert markdown into HTML string
  const processedContent = await remark()
    .use(html)
    .process(page.content);

  const contentHtml = processedContent.toString();

  return {
    props: {
      slug: params.slug,
      html: contentHtml,
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

function pagesFor(menu) {
  return Object.entries(menu).map(([, page]) => page);
}

function titleFor(page) {
  return page.title;
}

function loadPage(path) {
  const fullPath = `${contentDir}/${path}.md`

  const fileContents = fs.readFileSync(fullPath, "utf-8");

  // Use gray-matter to parse the post metadata section
  return matter(fileContents);
}