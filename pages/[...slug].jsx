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

export default function Page({ title, html }) {
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
                            <li><a>Overview</a></li>
                            <li>
                            <a className="is-active">Getting Started</a>
                            <ul>
                                <li><a>Hello world!</a></li>
                                <li><a>Cargo dependencies</a></li>
                                <li><a>Example: An Echo Server</a></li>
                            </ul>
                            </li>
                            <li><a>Going Deeper</a></li>
                            <li><a>I/O</a></li>
                            <li><a>Internals</a></li>
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
  const fullPath = `${[contentDir, ...params.slug].join(path.sep)}.md`;
  const fileContents = fs.readFileSync(fullPath, "utf-8");

  // Use gray-matter to parse the post metadata section
  const matterResult = matter(fileContents);

  // Use remark to convert markdown into HTML string
  const processedContent = await remark()
    .use(html)
    .process(matterResult.content);

  const contentHtml = processedContent.toString();

  return {
    props: {
      slug: params.slug,
      html: contentHtml,
      ...matterResult.data
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

// Load all front matter for markdown files in `/content` directory
function loadPages() {}