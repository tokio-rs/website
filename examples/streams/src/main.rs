extern crate futures;
extern crate tokio_core;

use futures::{Future, Stream};
use tokio_core::reactor::Core;
use tokio_core::net::TcpListener;

fn main() {
    let mut core = Core::new()
        .expect("Encountered IO error when creating reactor core");
    let address = "0.0.0.0:12345".parse().expect("Failed to parse address");
    let listener = TcpListener::bind(&address, &core.handle())
        .expect("Failed to bind listener to local port");

    let handle = core.handle();
    let server = listener.incoming().for_each(|(socket, _peer_addr)| {
        let conn_future = tokio_core::io::write_all(socket, b"Hello!\n")
            .then(|_| Ok(()));
        handle.spawn(conn_future);
        Ok(())
    });

    core.run(server).expect("Running server failed");
}
