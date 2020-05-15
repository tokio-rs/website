import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function Navigation() {
    return (
        <>
            <nav className="navbar" role="navigation" aria-label="main navigation">
                <div className="container">
                    <div className="navbar-brand">
                        <Brand />
                    </div>
                    <div className="navbar-menu">
                        <div className="navbar-end">
                            <Docs />
                            <SocialLinks />
                        </div>
                    </div>
                </div>
            </nav>
        </>
    )
}

function Brand() {
    return (
        <Link href="/">
            <a className="navbar-item">
                <img src="/img/tokio-horizontal.svg" width="133" height="56" />
            </a>
        </Link>
    )
}

function Docs() {
    return (
        <>
            <a className="navbar-item">Libraries</a>
            <a className="navbar-item">Docs</a>
            <a className="navbar-item">Community</a>
        </>
    )
}

function SocialLinks() {
    return (
        <>
            <a className="navbar-item" href="https://twitter.com/tokio_rs">
                <span className="icon">
                    <FontAwesomeIcon icon={['fab', 'twitter']} />
                </span>
            </a>
            <a className="navbar-item" href="https://github.com/tokio-rs/tokio">
                <span className="icon"><FontAwesomeIcon icon={['fab', 'github']} /> </span>
            </a>
            <a className="navbar-item" href="https://discord.gg/tokio">
                <span className="icon"><FontAwesomeIcon icon={['fab', 'discord']} /></span>
            </a>
        </>
    )
}