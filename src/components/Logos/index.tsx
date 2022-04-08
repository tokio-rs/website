import React, { FC } from "react";
import logos from './svg'
import styles from './styles.module.scss'
import heroStyles from '../../pages/index.module.scss'
import clsx from "clsx";

type Organization = {
  name: string;
  url: string;
};

const ORGANIZATIONS: Organization[] = [
  { name: "Linkerd", url: "https://linkerd.io" },
  { name: "Aws", url: "https://aws.amazon.com" },
  { name: "Discord", url: "https://discord.com/" },
  { name: "Azure", url: "https://azure.microsoft.com" },
  { name: "Pingcap", url: "https://pingcap.com" },
  { name: "Dropbox", url: "https://www.dropbox.com" },
  { name: "Facebook", url: "https://www.facebook.com" },
  { name: "One-Signal", url: "https://onesignal.com" },
];

const Logo: FC<{ org: Organization }> = (props) => (
  <div className="column is-3">
    <a href={props.org.url} target="_blank" rel="noopener noreferrer" aria-label={props.org.name}>
      <figure className={clsx(styles[props.org.name.toLowerCase()], styles.image)}>
        {logos[props.org.name.replace("-", "")]({ className: styles.logo, ...props })}
      </figure>
    </a>
  </div>
);


const Logos: FC = () => {
  return <section className={clsx("text-center", heroStyles.heroBanner)}>
    <div className="container">
      <h1 className={styles.title}>Built by the community, for the community.</h1>
      <nav className="container columns is-multiline is-mobile is-centered is-vcentered">
        {ORGANIZATIONS.map((org) => (
          <Logo key={org.name} org={org} />
        ))}
      </nav>
    </div>
  </section>
};

export default Logos;
