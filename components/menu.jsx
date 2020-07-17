import { useCallback, useState } from "react";
import classnames from "classnames";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function Menu({ href, menu }) {
  const groups = menu.map(({ key, title, nested }) => {
    return (
      <React.Fragment key={key}>
        <p className="menu-label">{title}</p>
        <Level1 href={href} menu={nested} />
      </React.Fragment>
    );
  });

  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <aside className="menu">
      <div
        className={classnames("tk-toc is-hidden-tablet", {
          "is-active": expanded,
        })}
      >
        <a href="#" onClick={() => toggleExpand()}>
          TABLE OF CONTENTS
          <span className="icon">
            <span className="tk-arrow"></span>
          </span>
        </a>
      </div>

      <div className={classnames("tk-menu-body", { "is-active": expanded })}>
        {groups}

        {/* TODO: hook this up, only when needed */}
        {/* <p className="menu-label tk-menu-back">
          <img
            src="/img/arrow-left-small.svg"
            style={{
              display: "inline-block",
              verticalAlign: "middle",
              height: "0.8rem",
              marginRight: "0.5rem",
            }}
          />
          <a>All Libraries</a>
        </p> */}
      </div>
    </aside>
  );
}

function Level1({ href, menu }) {
  const items = pagesFor(menu).map((entry) => {
    const isActive = href.startsWith(entry.href);
    const hasNested = entry.nested !== undefined;
    const className = isActive ? "is-active" : "";

    let link;

    if (entry.date) {
      const date = new Date(entry.date);
      link = (
        <a href={entry.href}>
          <b>
            {monthNames[date.getMonth()]} {date.getDate()}
          </b>
          {entry.title}
        </a>
      );
    } else {
      link = <a href={entry.href}>{entry.title}</a>;
    }

    return (
      <li key={entry.key} className={className}>
        {link}
        {hasNested && (
          <ul>
            <Level2 href={href} menu={entry} />
          </ul>
        )}
      </li>
    );
  });

  return <ul className="menu-list">{items}</ul>;
}

function Level2({ href, menu }) {
  const items = pagesFor(menu.nested).map((page) => {
    const className = href.startsWith(page.href) ? "is-active" : "";
    return (
      <li key={page.key} className={className}>
        <a href={page.href}>{page.title}</a>
      </li>
    );
  });

  if (menu.data.subtitle) {
    const className = href == menu.href ? "is-active" : "";
    items.unshift((
      <li key={menu.key} className={className}>
        <a href={menu.href}>{menu.data.subtitle}</a>
      </li>
    ));
  }

  return <ul>{items}</ul>;
}

function pagesFor(menu) {
  return Object.entries(menu).map(([, entry]) => {
    if (entry.page) {
      return {
        nested: entry.nested,
        ...entry.page,
      };
    } else {
      return entry;
    }
  });
}
