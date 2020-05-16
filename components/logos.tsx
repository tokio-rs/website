export default function Logos() {
    const items = [
        { name: 'linkerd', url: 'https://linkerd.io' },
        { name: 'azure', url: 'https://azure.microsoft.com' },
        { name: 'pingcap', url: 'https://pingcap.com' },
        { name: 'comcast', url: 'https://www.comcast.com' },
        { name: 'dropbox', url: 'https://www.dropbox.com' },
        { name: 'facebook', url: 'https://www.facebook.com' },
        { name: 'smart-things', url: 'https://www.smartthings.com' },
        { name: 'one-signal', url: 'https://onesignal.com' },
    ].map(({name, url}) => (
        <div key={name} className="column is-3"><a href={url} rel="nofollow"><img src={`/img/logos/${name}.svg`} /></a></div>
      ));

  return (
    <>
      <section className="hero tk-users">
        <div className="hero-body ">
          <div className="container has-text-centered">
            <h1 className="title">
              Built by the community, for the community.
            </h1>
            <nav className="container columns is-multiline is-centered is-vcentered">
                {items}
            </nav>
          </div>
        </div>
      </section>
    </>
  );
}