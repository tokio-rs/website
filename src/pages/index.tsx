import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './index.module.css';
import HomepageFeatures from '../components/HomepageFeatures';
import Hero from '../components/Hero';
import Logos from '../components/Logos';
import Libs from '../components/Libs';
import Stack from '../components/Stack';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)} data-theme="dark">
      <Hero></Hero>
    </header>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      description="Tokio is a runtime for writing reliable asynchronous applications with Rust. It provides async I/O, networking, scheduling, timers, and more.">
      <HomepageHeader />
      <main>
        <Logos />
        <Libs />
        <Stack />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
