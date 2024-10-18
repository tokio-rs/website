import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { visit } from "unist-util-visit";
import rust from "highlight.js/lib/languages/rust";

// Remove lines starting with `# `. This is code to make the doc tests pass
// but should not be displayed.
const remarkCodeRemoveSomeLines = () => {
  return (tree) => {
    visit(tree, "code", (node) => {
      const langs = ["rust", "rs"];
      if (node.lang && langs.includes(node.lang)) {
        node.value = node.value
          .split("\n")
          .map((line) => {
            let trimmed = line.trim();
            if (trimmed.startsWith("##")) {
              return line.replace("##", "#");
            } else if (trimmed.startsWith("# ")) {
              return null;
            } else if (trimmed === "#") {
              return null;
            } else {
              return line;
            }
          })
          .filter((line) => line !== null)
          .join("\n");
      }
    });
  };
};

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
  aliases: { rust: ["rs", "rust,compile_fail", "rust,ignore", "rust="] },
  plainText: ["txt", "text", "plain", "log"],
};

export const toHTML = async (raw) => {
  return String(
    await unified()
      .use(remarkParse)
      .use(remarkCodeRemoveSomeLines)
      // @ts-expect-error: unified's plugin type mistakenly selects the wrong union overload
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeHighlight, rehypeHighlightOptions)
      .use(rehypeRaw)
      .use(rehypeSlug)
      .use(rehyperBlockquotePlus, rehyperBlockquotePlusOptions)
      // @ts-expect-error: unified's plugin type mistakenly selects the Array<void> union variant
      .use(rehypeStringify)
      .process(raw)
  );
};
