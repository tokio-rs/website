import Menu from "../components/menu";
import { DiscordIcon, GitHubIcon } from "./icons";
import ReactMarkdown from "react-markdown/with-html";
import SyntaxHighlighter from "react-syntax-highlighter";

const CodeBlock = ({ language, value }) => {
  return (
    <SyntaxHighlighter useInlineStyles={false} language={language}>
      {value}
    </SyntaxHighlighter>
  );
};

export default function Content({ menu, href, title, next, prev, body }) {
  return (
    <>
      <div className="columns is-marginless tk-docs">
        <div className="column is-one-quarter tk-docs-nav">
          <Menu href={href} menu={menu} />
        </div>
        <div className="column is-three-quarters">
          <section className="section content tk-content">
            <h1 className="title">{title}</h1>
            <ReactMarkdown
              escapeHtml={false}
              source={body}
              renderers={{ code: CodeBlock }}
            />
            <div className="tk-doc-footer">
              <div className="level">
                <div className="level-left">
                  <div className="level-item tk-prev">
                    {next && (
                      <a href={next.href}>
                        <span
                          className="tk-arrow"
                          style={{ marginRight: "0.5rem" }}
                        >
                          <img src="/img/arrow-left.svg" />
                        </span>
                        {next.title}
                      </a>
                    )}
                  </div>
                </div>
                <div className="level-right">
                  <div className="level-item tk-next">
                    {prev && (
                      <a href={prev.href}>
                        {prev.title}
                        <span
                          className="tk-arrow"
                          style={{ marginLeft: "0.5rem" }}
                        >
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
                    <a href="#">Edit this page</a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
