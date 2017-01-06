extern crate futures;
extern crate tokio_core;
extern crate tokio_service;

use std::io;
use tokio_core::io::{Io, Codec, EasyBuf};
use tokio_core::reactor::Core;
use tokio_core::net::TcpListener;
use tokio_service::{Service, NewService};
use futures::{BoxFuture, Future, future, Stream, Sink};

pub struct LineCodec;

impl Codec for LineCodec {
    type In = EasyBuf;
    type Out = EasyBuf;

    fn decode(&mut self, buf: &mut EasyBuf) -> io::Result<Option<Self::In>> {
        if let Some(i) = buf.as_slice().iter().position(|&b| b == b'\n') {
            // remove the line, including the '\n', from the buffer
            let mut full_line = buf.drain_to(i + 1);

            // strip the `\n` from the returned buffer
            Ok(Some(full_line.drain_to(i)))
        } else {
            Ok(None)
        }
    }

    fn encode(&mut self, item: EasyBuf, into: &mut Vec<u8>)
              -> io::Result<()>
    {
        into.extend(item.as_slice());
        into.push(b'\n');
        Ok(())
    }
}

fn serve<S>(s: S) -> io::Result<()>
    where S: NewService<Request = EasyBuf,
                        Response = EasyBuf,
                        Error = io::Error> + 'static
{
    let mut core = Core::new()?;
    let handle = core.handle();

    let address = "0.0.0.0:12345".parse().unwrap();
    let listener = TcpListener::bind(&address, &handle)?;

    let connections = listener.incoming();
    let server = connections.for_each(move |(socket, _peer_addr)| {
        let (writer, reader) = socket.framed(LineCodec).split();
        let mut service = s.new_service()?;

        let responses = reader.and_then(move |req| service.call(req));
        handle.spawn(writer.send_all(responses)).then(|_| Ok(())));

        Ok(())
    });

    core.run(server)
}

struct EchoService;

impl Service for EchoService {
    type Request = EasyBuf;
    type Response = EasyBuf;
    type Error = io::Error;
    type Future = BoxFuture<EasyBuf, io::Error>;
    fn call(&mut self, input: EasyBuf) -> Self::Future {
        future::ok(input).boxed()
    }
}

fn main() {
    if let Err(e) = serve(|| Ok(EchoService)) {
        println!("Server failed with {}", e);
    }
}
