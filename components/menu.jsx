export default function Menu({ slug, data }) {
  return (
    <aside className="menu">
      <p className="menu-label">Tokio</p>
      <ul className="menu-list">
        {pagesFor(data).map((page) => {
          const isActive = slug.startsWith(page.slug);
          const hasChildren = isActive && page.pages !== undefined;
          const className = isActive ? "is-active" : "";

          return (
            <>
              <li key={page.key} className={className}>
                <a href={page.href}>{page.title}</a>
                {hasChildren && (
                  <>
                    <ul>
                      {pagesFor(page.pages).map((page) => {
                        const className = slug.startsWith(page.slug)
                          ? "is-active"
                          : "";
                        return (
                          <>
                            <li key={page.key} className={className}>
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
      {/* TODO: hook this up, only when needed */}
      <p className="menu-label">
        <img
          src="/img/left-arrow.svg"
          style={{
            display: "inline-block",
            verticalAlign: "middle",
            height: "0.8rem",
            marginRight: "0.5rem",
          }}
        />
        <a>All Libraries</a>
      </p>
    </aside>
  );
}

function pagesFor(menu) {
  return Object.entries(menu).map(([, page]) => page);
}
