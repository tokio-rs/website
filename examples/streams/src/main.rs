extern crate futures;
extern crate tokio_core;

use futures::{Future, Stream};
use tokio_core::reactor::Core;
use tokio_core::net::TcpListener;

fn main() {
    let mut core = Core::new().unwrap();
    let address = "0.0.0.0:12345".parse().unwrap();
    let listener = TcpListener::bind(&address, &core.handle()).unwrap();

    let handle = core.handle();
    let server = listener.incoming().for_each(|(socket, _peer_addr)| {
        let conn_future = tokio_core::io::write_all(socket, b"Hello!\n")
            .then(|_| Ok(()));
        handle.spawn(conn_future);
        Ok(())
    });

    core.run(server).unwrap();
}
