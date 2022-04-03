import React, { FC } from "react";
import logos from './svg'
import styles from './styles.module.scss'
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
  <a href={props.org.url} rel="nofollow">
    <figure className={`image ${props.org.name}`}>
      {logos[props.org.name.replace("-", "")]({ className: styles.logo, ...props })}
    </figure>
  </a>
);

const Row = ({ from, to }) => {
  return (
    <div className="row">
      {ORGANIZATIONS.slice(from, to).map(org => {
        return <div key={org.name} className={clsx("col col--3", styles.logoContainer)}> <Logo org={org} /></div>
      })}
    </div>
  )
}

const Logos: FC = () => {
  return <section className="text-center hero">
    <div className="container">
      <h1 className="title">Built by the community, for the community.</h1>
      <Row from={0} to={4} />
      <Row from={4} to={8} />
    </div>
  </section>
};

export default Logos;
