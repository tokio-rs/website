import React, { FC, useEffect } from "react";
import clsx from "clsx";
import { StackLayer, STACK_LAYERS } from "./stackInfos";
import onscrollUpdateStacks from './tk-stack.js';
import styles from './styles.module.scss';
import TokioSVG from "../TokioSvg";


const Menu: FC = () => {
  return (<div className={clsx("column is-1", styles.tkMenu, "is-hidden-touch")}>
    <div className={clsx("container", styles.anchor)}>
      <aside className={clsx(styles.menu, "menu")}>
        <ul className={clsx("menu-list")}>
          {STACK_LAYERS.map((layer) => {
            return (
              <li key={layer.id} className={clsx(styles[`tkLib${layer.id}`], styles.link)}>
                <a href={`#tkLib${layer.id}`}>{layer.short || layer.name}</a>{" "}
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  </div >)
};

const Layer: FC<{ layer: StackLayer }> = ({ layer }) => (
  <div className={clsx(styles.card)}>
    <div
      id={"tkLibStack" + layer.id}
      className={clsx("card-content", styles[`tkLib${layer.id}`])}
    >
      <div className="media">
        <div className="media-content">
          <a
            id={`tkLib${layer.id}`}
            style={{
              display: "block",
              position: "relative",
              top: "-40vh",
              visibility: "hidden",
            }}
          />
          <h1 className={clsx(styles.title, "is-4")}>
            {layer.id === "tokio" ? <TokioSVG /> : <img src={`/img/icons/${layer.id}.svg`} alt={layer.name} />}
            {layer.name}
          </h1>
        </div>
      </div>
      <div className="content">
        <h2 className={styles.subtitle}>{layer.desc}</h2>
        {layer.href && (
          <p className={clsx(styles.learnMore)}>
            <a href={layer.href}>Learn more ➔</a>
          </p>
        )}
      </div>
    </div>
  </div>
);

export default function Stack() {
  useEffect(() => {
    var stack = document.getElementsByClassName(styles.tkStackActive);
    var links = document.querySelectorAll("." + styles.link);
    var lines = document.getElementById("tkStackLines");

    // Done in JS so that when JS is not enabled, no links are enabled.
    links[0].classList.add(styles.isActive);

    var stackElems = [];
    for (var i = 0; i < stack.length; ++i) {
      var stackId = stack[i].dataset.stackId;
      var div = document.getElementById("tkLibStack" + stackId);
      // The boolean stores whether it is currently opaque.
      stackElems.push([stack[i], div, true]);
    }

    if (stackElems.length > 0) {
      var fn = function() {
        onscrollUpdateStacks(stackElems, links, lines);
      };
      window.addEventListener("scroll", fn);
      window.addEventListener("resize", fn);
      setTimeout(fn);
    }
  }, [])

  return (
    <section className={styles.tkStack}>
      <div className="container">
        <div className="columns">
          <Menu />

          <div className={clsx("column is-5-desktop is-half-tablet ", styles.tkLibs)}>
            {STACK_LAYERS.map((l) => (
              <Layer layer={l} key={l.id} />
            ))}
          </div>

          <div className="column is-half is-hidden-mobile">
            <div className={clsx("container", styles.anchor)}>
              {STACK_LAYERS.slice(1).map(({ id, zIndex }) => {
                return (
                  <img
                    key={id}
                    className={clsx(styles.tkStackActive)}
                    data-stack-id={id}
                    src={"/img/stack-" + id + ".svg"}
                    style={{ zIndex: zIndex }}
                  />
                )
              })}
              {/* Special handling */}
              <img
                id="tkStackLines"
                data-stack-id="lines"
                src="/img/stack-lines.svg"
                style={{ zIndex: 7 }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
