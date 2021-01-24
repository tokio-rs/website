import Menu from "../components/menu";
import classnames from "classnames";
import { DiscordIcon, GitHubIcon } from "./icons";
import React from "react";
import ReactMarkdown from "react-markdown/with-html";
import SyntaxHighlighter from "react-syntax-highlighter";
import GithubSlugger from "github-slugger";
import CustomBlocks from "remark-custom-blocks";

const CodeBlock = ({ language, value }) => {
  // Remove lines starting with `# `. This is code to make the doc tests pass
  // but should not be displayed.
  value = value
    .split("\n")
    .filter((line) => !line.startsWith("# "))
    .join("\n");

  return (
    <SyntaxHighlighter useInlineStyles={false} language={language}>
      {value}
    </SyntaxHighlighter>
  );
};

const Blocks = {
  warning: {
    classes: "is-warning",
  },
  info: {
    classes: "is-info",
  },
};

function Heading(slugger, headings, props) {
  let children = React.Children.toArray(props.children);
  let text = children.reduce(flatten, "");
  let slug = slugger.slug(text);
  headings.push({ level: props.level, title: text, slug });
  return React.createElement("h" + props.level, { id: slug }, props.children);
}

function Block({
  children,
  data: {
    hProperties: { className },
  },
}) {
  return (
    <blockquote className={classnames(...className)}>{children}</blockquote>
  );
}

function BlockBody({ children }) {
  return children;
}

function flatten(text, child) {
  return typeof child === "string"
    ? text + child
    : React.Children.toArray(child.props.children).reduce(flatten, text);
}

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
  let menu = [];

  for (const heading of headings) {
    insertHeading(heading, menu);
  }

  const list = menu.map((entry) => {
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

  return (
    <aside className="column is-one-third tk-content-summary">
      <ul className="tk-content-summary-menu">{list}</ul>
    </aside>
  );
}

export default function Content({ menu, href, title, next, prev, body, mdPath }) {
  const slugger = new GithubSlugger();
  let headings = [{ level: 1, title, slug: "" }];
  const HeadingRenderer = (props) => {
    return Heading(slugger, headings, props);
  };

  return (
    <>
      <div className="columns is-marginless tk-docs">
        <div className="column is-one-quarter tk-docs-nav">
          <Menu href={href} menu={menu} />
        </div>
        <div className="column is-three-quarters tk-content">
          <section className="section content">
            <div className="columns">
              <div className="column is-two-thirds tk-markdown">
                <h1 className="title">{title}</h1>
                <ReactMarkdown
                  escapeHtml={false}
                  source={body}
                  renderers={{
                    code: CodeBlock,
                    heading: HeadingRenderer,
                    warningCustomBlock: Block,
                    warningCustomBlockBody: BlockBody,
                    infoCustomBlock: Block,
                    infoCustomBlockBody: BlockBody,
                  }}
                  plugins={[[CustomBlocks, Blocks]]}
                />
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
