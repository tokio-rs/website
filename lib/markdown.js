import { stream } from "unified-stream";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { visit } from "unist-util-visit";
import rust from "highlight.js/lib/languages/rust";

const rehyperBlockquotePlus = (options) => {
  return (tree) => {
    visit(tree, "element", (node) => {
      // blockquote -> p -> strong -> Text -> Text.value

      if (node.tagName === "blockquote") {
        const p = node.children?.filter((node) => node.tagName === "p")?.[0];
        const strong = p.children?.[0];
        if (strong && strong.tagName === "strong") {
          options.rules.forEach(([title, classname]) => {
            if (strong.children?.[0].value === title) {
              p.children.shift();
              node.properties.className = classname;
            }
          });
        }
      }
    });
  };
};

const rehyperBlockquotePlusOptions = {
  rules: [
    ["info", "is-info"],
    ["Info", "is-info"],
    ["INFO", "is-info"],
    ["warning", "is-warning"],
    ["Warning", "is-warning"],
    ["WARNING", "is-warning"],
  ],
};

const rehypeHighlightOptions = {
  languages: { rust: rust },
  aliases: { rust: ["rs", "rust,compile_fail"] },
};

export const toHTML = async (raw) => {
  return String(
    await unified()
      .use(remarkParse)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeHighlight, rehypeHighlightOptions)
      .use(rehypeRaw)
      .use(rehypeSlug)
      .use(rehyperBlockquotePlus, rehyperBlockquotePlusOptions)
      .use(rehypeStringify)
      .process(raw)
  );
};