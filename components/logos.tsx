import React, { FC } from "react";

type Organization = {
  name: string;
  url: string;
};

const ORGANIZATIONS: Organization[] = [
  { name: "linkerd", url: "https://linkerd.io" },
  { name: "aws", url: "https://aws.amazon.com" },
  { name: "azure", url: "https://azure.microsoft.com" },
  { name: "pingcap", url: "https://pingcap.com" },
  { name: "comcast", url: "https://www.comcast.com" },
  { name: "dropbox", url: "https://www.dropbox.com" },
  { name: "facebook", url: "https://www.facebook.com" },
  { name: "one-signal", url: "https://onesignal.com" },
];

const Logo: FC<{ org: Organization }> = ({ org }) => (
  <div key={org.name} className="column is-3">
    <a href={org.url} rel="nofollow">
      <figure className={`image ${org.name}`}>
        <img src={`/img/logos/${org.name}.svg`} alt={org.name} />
      </figure>
    </a>
  </div>
);

const Logos: FC = () => (
  <section className="hero tk-users">
    <div className="hero-body">
      <div className="container has-text-centered">
        <h1 className="title">Built by the community, for the community.</h1>
        <nav className="container columns is-multiline is-mobile is-centered is-vcentered">
          {ORGANIZATIONS.map((org) => (
            <Logo key={org.name} org={org} />
          ))}
        </nav>
      </div>
    </div>
  </section>
);

export default Logos;
