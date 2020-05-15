import Head from 'next/head'
import Link from 'next/link'
import SocialLinks from './nav/links'
import DocLinks from './nav/docs'
import Brand from './nav/brand'

export default function Layout({ children }) {
    return (
        <>
            <Head>
                <title>Tokio</title>
                <meta name="viewport" content="width=device-width, initial-scale=1"></meta>
                <script src="https://use.fontawesome.com/e6423403d1.js"></script>
                {/* <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap" rel="stylesheet"></link> */}
            </Head>
            <nav className="navbar" role="navigation" aria-label="main navigation">
                <div className="container">
                    <div className="navbar-brand">
                        <Brand />
                    </div>
                    <div className="navbar-menu">
                        <div className="navbar-end">
                            <DocLinks />
                            <SocialLinks />
                        </div>
                    </div>
                </div>
            </nav>
        </>
    )
}