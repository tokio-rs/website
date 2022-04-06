import React, { FC, ReactNode } from "react";
import styles from "./styles.module.scss"
import clsx from "clsx";
import heroStyles from '../Hero/styles.module.scss';
import { chunkify } from '../../utils'

type Library = {
  id: string;
  name: string;
  desc: ReactNode;
};

const LIBS: Library[] = [
  {
    id: "Runtime",
    name: "Reliable",
    desc:
      "Tokio's APIs are memory-safe, thread-safe, and misuse-resistant. This helps prevent common bugs, such as unbounded queues, buffer overflows, and task starvation.",
  },
  {
    id: "Hyper",
    name: "Fast",
    desc:
      "Building on top of Rust, Tokio provides a multi-threaded, work-stealing scheduler. Applications can process hundreds of thousands of requests per second with minimal overhead.",
  },
  {
    id: "Tonic",
    name: "Easy",
    desc: (
      <>
        <code>async</code>/<code>await</code> reduces the complexity of writing
        asynchronous applications. Paired with Tokio's utilities and vibrant
        ecosystem, writing applications is a breeze.
      </>
    ),
  },
  {
    id: "Tower",
    name: "Flexible",
    desc:
      "The needs of a server application differ from that of an embedded device. Although Tokio comes with defaults that work well out of the box, it also provides the knobs needed to fine tune to different cases.",
  },
];

const Lib: FC<{ lib: Library }> = ({ lib }) => (
  <div
    className={clsx(
      heroStyles.hero,
      styles.tkLib,
      styles[`tkLib${lib.id}`]
    )}
  >
    <div className={clsx(styles.card, heroStyles.tkIntro)}>
      <div className="card-content">
        <div className="media">
          <div className="media-content">
            <h1 className={clsx(styles.title, heroStyles.title)}>{lib.name}</h1>
          </div>
        </div>
        <div className="content">
          <div className={clsx(heroStyles.subtitle)}>{lib.desc}</div>
        </div>
        {/* <p className="learn-more has-text-right">
          <a href="#">Learn more ➔</a>
        </p> */}
      </div>
    </div>
  </div>
);

const Libs: FC = () => (
  <section className={styles.tkFeatures}>
    <div className="container">
      <div className="columns is-multiline">
        {chunkify(LIBS, 2).map((libs, i) => (
          <div key={i} className="row">
            {
              libs.map((lib: Library) => {
                return <div key={lib.id} className="col col--6"> <Lib lib={lib} key={lib.id} /></div>
              })
            }
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Libs;
