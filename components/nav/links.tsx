import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export default function SocialLinks() {
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