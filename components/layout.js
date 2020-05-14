import Head from 'next/head'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export default function Layout({ children }) {
    return (
        <>
            <Head>
                <title>Tokio</title>
                <script src="https://use.fontawesome.com/e6423403d1.js"></script>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap" rel="stylesheet"></link>
            </Head>
            <body>
                <nav className="navbar" className="navbar" role="navigation" aria-label="main navigation">
                    <div className="container">
                        <div className="navbar-brand">
                            <Link href="/">
                                <a className="navbar-item">
                                    <img src="/img/tokio-horizontal.svg" width="133" height="56"/>
                                </a>
                            </Link>
                        </div>
                        <div className="navbar-menu">
                            <div className="navbar-end">
                                <a className="navbar-item">Libraries</a>
                                <a className="navbar-item">Docs</a>
                                <a className="navbar-item">Community</a>
                                
                                <a className="navbar-item" href="https://twitter.com/tokio_rs">
                                    <span className="icon">
                                        <FontAwesomeIcon icon={['fab', 'twitter']} />
                                    </span>
                                </a>

                                {/* <a className="navbar-item icon" href="https://github.com/tokio-rs/tokio">
                                    <span className="icon"><FontAwesomeIcon icon={['fab', 'github']} /></span>
                                </a>
                                <a className="navbar-item icon" href="https://discord.gg/tokio">
                                    <span className="icon"><FontAwesomeIcon icon={['fab', 'discord']} /></span>
                                </a> */}
                            </div>
                        </div>
                    </div>
                </nav>
                <section className="section">
                    <div className="container">
                        <h1 className="title">
                            Hello World
                        </h1>
                        {children}
                    </div>
                </section>
            </body>
        </>
        // <!DOCTYPE html>
        // <html>
        // <head>
        //     <meta charset="utf-8">
        //     <meta name="viewport" content="width=device-width, initial-scale=1">
        //     <title>Hello Bulma!</title>
        //     <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.8.2/css/bulma.min.css">
        //     <script defer src="https://use.fontawesome.com/releases/v5.3.1/js/all.js"></script>
        // </head>
        // <body>
        // <section class="section">
        //     <div class="container">
        //     <h1 class="title">
        //         Hello World
        //     </h1>
        //     <p class="subtitle">
        //         My first website with <strong>Bulma</strong>!
        //     </p>
        //     </div>
        // </section>
        // </body>
        // </html>
    )
  }