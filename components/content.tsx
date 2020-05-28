import Menu from "../components/menu";
import ReactMarkdown from "react-markdown/with-html";
import SyntaxHighlighter from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/cjs/styles/hljs";

const CodeBlock = ({ language, value }) => {
  return (
    <SyntaxHighlighter style={docco} language={language}>
      {value}
    </SyntaxHighlighter>
  );
};

// const Props = {
//   menu:
// }

export default function Content({ menu, href, title, body }) {
  return (
    <>
      <div className="columns is-marginless tk-docs">
        <div
          className="column is-one-quarter tk-docs-nav"
          style={{ padding: "4rem 0 0 1rem" }}
        >
          <Menu href={href} menu={menu} />
        </div>
        <div className="column is-three-quarters">
          <section
            className="section content tk-content"
            style={{ minHeight: "90vh" }}
          >
            <h1 className="title">{title}</h1>
            <ReactMarkdown
              escapeHtml={false}
              source={body}
              renderers={{ code: CodeBlock }}
            />
          </section>
        </div>
      </div>
    </>
  );
}
