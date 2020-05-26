import * as api from "../../lib/api";
import Page from "../../lib/page";

const menu = {
  overview: {
    title: "Overview",
    pages: ["reliable", "fast", "easy", "flexible"],
  },
  "getting-started": {
    title: "Getting Started",
    pages: ["hello-world", "cargo-dependencies", "echo"],
  },
  topics: {
    title: "Topics",
    pages: ["concurrency"],
  },
  api: {
    title: "Api documentation",
    href: "https://docs.rs/tokio",
  },
};

export default Page;

export async function getStaticPaths() {
  return api.getMenuPaths(menu);
}

export async function getStaticProps({ params: { slug } }) {
  return api.withAppProps(await api.getProps(menu, "docs", slug));
}
