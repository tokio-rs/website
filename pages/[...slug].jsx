import * as api from "../lib/api";
import Page from "../lib/page";

const menu = {
  tokio: {
    title: "Tokio",
    nested: {
      tutorial: {
        nested: [
          "hello-tokio",
          "spawning",
          "shared-state",
          "channels",
          "io",
          "framing",
          "async",
          "select",
          "streams",
        ],
      },
      glossary: {},
      api: {
        title: "API documentation",
        href: "https://docs.rs/tokio",
      },
    },
  },
};

export default Page;

export async function getStaticPaths() {
  return api.getMenuPaths(menu);
}

export async function getStaticProps({ params: { slug } }) {
  return api.withAppProps(await api.getProps(menu, slug));
}
