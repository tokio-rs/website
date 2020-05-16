import Head from "next/head";
import Navigation from "./nav";

export default function Layout({ children }) {
  return (
    <>
      <Head>
        <title>Tokio</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        ></meta>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        ></link>
      </Head>
      <Navigation />
      {children}
      <footer className="footer">
        <div className="content has-text-centered">
          <p>
            <strong>Tokio</strong> by{" "}
            <a href="https://github.com/tokio-rs/tokio/graphs/contributors">
              People
            </a>
            . The source code is licensed
            <a href="http://opensource.org/licenses/mit-license.php">MIT</a>.
            The website content is licensed{" "}
            <a href="http://creativecommons.org/licenses/by-nc-sa/4.0/">
              CC BY NC SA 4.0
            </a>
            .
          </p>
        </div>
      </footer>
    </>
  );
}
