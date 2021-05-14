import React, { FC, ReactNode } from "react";

import Head from "next/head";
import Navigation from "./nav";

type Props = {
  title?: string;
  blog: any; // TODO: Don't know what this is yet...
  children: ReactNode;
};

function pageTitle(title: string | undefined): string {
  const name = "Tokio";
  return title ? `${title} | ${name}` : name;
}

const Layout: FC<Props> = ({ title, blog, children }) => (
  <>
    <Head>
      <title>{pageTitle(title)}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="alternate icon" type="image/png" href="/favicon-32x32.png" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="alternate" type="application/rss+xml" href="/_next/static/feed.xml" />

      <link
        href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <script defer src="/tk-stack.js"></script>
    </Head>
    <Navigation blog={blog} />
    {children}
  </>
);

export default Layout;
