import Menu from "../components/menu";
import classnames from "classnames";
import { DiscordIcon, GitHubIcon } from "./icons";
import React, {
  ComponentPropsWithoutRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { CodeComponent } from "react-markdown/lib/ast-to-react";
import { ReactMarkdownProps } from "react-markdown/lib/complex-types";

const CodeBlock: CodeComponent = ({ className, children, inline }) => {
  // Remove lines starting with `# `. This is code to make the doc tests pass
  // but should not be displayed.
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "rs";

  const value = String(children)
    .split("\n")
    .filter((line) => !line.startsWith("# "))
    .join("\n");

  return inline ? (
    <code>{value}</code>
  ) : (
    <SyntaxHighlighter useInlineStyles={false} language={language} PreTag="div">
      {value}
    </SyntaxHighlighter>
  );
};

const BlockquoteBlock = ({
  node,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"blockquote"> & ReactMarkdownProps) => {
  const [name, setName] = useState("");
  const quoteRef = useRef<HTMLQuoteElement>(null);
  useEffect(() => {
    if (quoteRef.current) {
      const strong = quoteRef.current.getElementsByTagName("strong").item(0);
      const isWarning = strong.innerText.match(/warning/i);
      const isInfo = strong.innerText.match(/info/i);
      setName(isWarning ? "is-warning" : isInfo ? "is-info" : "");
      if (isWarning || isInfo) {
        strong.parentNode.removeChild(strong);
      }
    }
  }, [quoteRef]);
  return (
    <blockquote
      ref={quoteRef}
      className={classnames(name, className)}
      {...props}
    >
      {children}
    </blockquote>
  );
};

// function flatten(text, child) {
//   return typeof child === "string"
//     ? text + child
//     : React.Children.toArray(child.props.children).reduce(flatten, text);
// }

function Footer({ next, prev, mdPath }) {
  let edit = `https://github.com/tokio-rs/website/edit/master/content/${mdPath}`;
  return (
    <div className="tk-doc-footer">
      <div className="level">
        <div className="level-left">
          <div className="level-item tk-prev">
            {prev && (
              <a href={prev.href} rel="prev">
                <span className="tk-arrow" style={{ marginRight: "0.5rem" }}>
                  <img src="/img/arrow-left.svg" />
                </span>
                {prev.title}
              </a>
            )}
          </div>
        </div>
        <div className="level-right">
          <div className="level-item tk-next">
            {next && (
              <a href={next.href} rel="next">
                {next.title}
                <span className="tk-arrow" style={{ marginLeft: "0.5rem" }}>
                  <img src="/img/arrow-right.svg" />
                </span>
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="level">
        <div className="level-left">
          <div className="level-item tk-help-links">
            <p>
              Get Help:
              <a href="https://github.com/tokio-rs/tokio/discussions">
                <GitHubIcon className="is-medium" />
              </a>
              <a href="https://discord.gg/tokio">
                <DiscordIcon className="is-medium" />
              </a>
            </p>
          </div>
        </div>
        <div className="level-right">
          <div className="level-item tk-edit-this-page">
            <a href={edit}>Edit this page</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function insertHeading(heading, menu, level = 1) {
  if (level == heading.level || menu.length == 0) {
    menu.push({
      heading,
      nested: [],
    });
  } else {
    insertHeading(heading, menu[menu.length - 1].nested, level + 1);
  }
}

function TableOfContents({ headings }) {
  const list = useMemo(() => {
    let menu = [];
    for (const heading of headings) {
      insertHeading(heading, menu);
    }

    return menu.map((entry) => {
      const heading = entry.heading;

      let nested = entry.nested.map((entry) => {
        const heading = entry.heading;

        return (
          <li key={heading.slug}>
            <a href={`#${heading.slug}`}>{heading.title}</a>
          </li>
        );
      });

      return (
        <li key={heading.slug}>
          <a href={`#${heading.slug}`}>{heading.title}</a>
          {entry.nested.length > 0 && <ul>{nested}</ul>}
        </li>
      );
    });
  }, [headings]);

  return (
    <aside className="column is-one-third tk-content-summary">
      <ul className="tk-content-summary-menu">{list}</ul>
    </aside>
  );
}

export default function Content({
  menu,
  href,
  title,
  next,
  prev,
  body,
  mdPath,
}) {
  const isBlogRoute = href.startsWith("/blog");

  const [headings, setHeadings] = useState([]);
  const mdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mdRef.current?.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
      const level = Number(el.tagName.slice(-1));
      const title = el.textContent;
      const slug = el.id;
      setHeadings((headings) => [...headings, { level, title, slug }]);
    });
    return () => {
      setHeadings([]);
    };
  }, [mdRef]);

  return (
    <>
      <div className="columns is-marginless tk-docs">
        <div className="column is-one-quarter tk-docs-nav">
          <Menu href={href} menu={menu}>
            {isBlogRoute && (
              <div className="all-posts-link">
                <Link href="/blog">More Blog Posts</Link>
              </div>
            )}
          </Menu>
        </div>
        <div className="column is-three-quarters tk-content">
          <section className="section content">
            <div className="columns">
              <div className="column is-two-thirds tk-markdown" ref={mdRef}>
                <h1 className="title" id="">
                  {title}
                </h1>
                <ReactMarkdown
                  components={{
                    // pre: CodeBlock,
                    code: CodeBlock,
                    blockquote: BlockquoteBlock,
                  }}
                  remarkPlugins={[[remarkGfm]]}
                  rehypePlugins={[[rehypeRaw], [rehypeSlug]]}
                >
                  {body}
                </ReactMarkdown>
                <Footer next={next} prev={prev} mdPath={mdPath} />
              </div>
              <TableOfContents headings={headings} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
