import Menu from "../components/menu";

export default function Content({ menu, title, body }) {
  return (
    <>
      <div className="columns is-marginless tk-docs">
        <div
          className="column is-one-quarter tk-docs-nav"
          style={{ padding: "4rem 0 0 1rem" }}
        >
          <Menu data={menu} />
        </div>
        <div className="column is-three-quarters">
          <section
            className="section content tk-content"
            style={{ minHeight: "90vh" }}
          >
            <h1 className="title">{title}</h1>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </section>
        </div>
      </div>
    </>
  );
}
