import React, { FC } from "react";
import { DiscordIcon, GitHubIcon, TwitterIcon } from "./icons";

const DATA = [
  {
    name: "twitter",
    url: "https://twitter.com/tokio_rs",
    icon: <TwitterIcon />,
  },
  {
    name: "github",
    url: "https://github.com/tokio-rs/tokio",
    icon: <GitHubIcon />,
  },
  {
    name: "discord",
    url: "https://discord.gg/tokio",
    icon: <DiscordIcon />,
  },
];

const SocialLinks: FC = () => (
  <>
    {DATA.map((link) => (
      <a
        className="navbar-item navbar-icon tk-social"
        href={link.url}
        key={link.name}
      >
        {link.icon}
      </a>
    ))}
  </>
);

export default SocialLinks;
