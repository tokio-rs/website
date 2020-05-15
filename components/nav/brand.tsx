import Link from "next/link";

export default function Brand() {
    return (
        <Link href="/">
            <a className="navbar-item">
                <img src="/img/tokio-horizontal.svg" width="133" height="56" />
            </a>
        </Link>
    )
}