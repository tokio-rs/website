import React from "react";

import Hero from "../components/hero";
import Layout from "../components/layout";
import Footer from "../components/footer";
import Libs from "../components/libs";
import Logos from "../components/logos";
import Stack from "../components/stack";
import * as api from "../lib/api";

export default function Home({ app }) {
  return (
    <Layout blog={app.blog}>
      <div className="tk-landing">
        <Hero />
        <Logos />
        <Libs />
        <Stack />
      </div>
      <Footer />
    </Layout>
  );
}

export async function getStaticProps() {
  return await api.withAppProps();
}
