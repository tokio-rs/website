export default function Menu({ data }) {
  return (
    <aside
      className="menu"
      style={{
        position: "sticky",
        top: "4rem",
        maxWidth: "250px",
        marginLeft: "auto",
      }}
    >
      <p className="menu-label">Tokio</p>
      <ul className="menu-list">
        {pagesFor(data).map((page) => {
          const hasChildren = page.pages !== undefined;

          return (
            <>
              <li key={page.key}>
                <a href={page.href}>{page.title}</a>
                {hasChildren && (
                  <>
                    <ul>
                      {pagesFor(page.pages).map((page) => {
                        console.debug("KEY", page.key);
                        return (
                          <>
                            <li key={page.key}>
                              <a href={page.href}>{page.title}</a>
                            </li>
                          </>
                        );
                      })}
                    </ul>
                  </>
                )}
              </li>
            </>
          );
        })}
      </ul>
      {/* <p className="menu-label">
        <img src="/img/left-arrow.svg" style={{ display: "inline-block", verticalAlign: "middle", height: "0.8rem", marginRight: "0.5rem"}}/>
        <a>All Libraries</a>
    </p> */}
    </aside>
  );
}

function pagesFor(menu) {
  return Object.entries(menu).map(([, page]) => page);
}
