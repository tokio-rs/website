export type StackLayer = {
  id: string;
  short?: string;
  name: string;
  desc: string;
  zIndex: number;
  href?: string;
};

const STACK_LAYERS: StackLayer[] = [
  {
    id: "tokio",
    short: "Stack",
    name: "The stack",
    desc:
      "Applications aren't built in a vacuum. The Tokio stack includes everything needed to ship to production, fast.",
    zIndex: 0,
  },
  {
    id: "runtime",
    name: "Runtime",
    desc:
      "Including I/O, timer, filesystem, synchronization, and scheduling facilities, the Tokio runtime is the foundation of asynchronous applications.",
    zIndex: 3,
    href: "/tokio/tutorial",
  },
  {
    id: "hyper",
    name: "Hyper",
    desc:
      "An HTTP client and server library supporting both the HTTP 1 and 2 protocols.",
    zIndex: 4,
    href: "https://github.com/hyperium/hyper",
  },
  {
    id: "tonic",
    name: "Tonic",
    desc:
      "A boilerplate-free gRPC client and server library. The easiest way to expose and consume an API over the network.",
    zIndex: 6,
    href: "https://github.com/hyperium/tonic",
  },
  {
    id: "tower",
    name: "Tower",
    desc:
      "Modular components for building reliable clients and servers. Includes retry, load-balancing, filtering, request-limiting facilities, and more.",
    zIndex: 5,
    href: "https://github.com/tower-rs/tower",
  },
  {
    id: "mio",
    name: "Mio",
    desc:
      "Minimal portable API on top of the operating-system's evented I/O API.",
    zIndex: 2,
    href: "https://github.com/tokio-rs/mio",
  },
  {
    id: "tracing",
    name: "Tracing",
    desc:
      "Unified insight into the application and libraries. Provides structured, event-based, data collection and logging.",
    zIndex: 0,
    href: "https://github.com/tokio-rs/tracing",
  },
  {
    id: "bytes",
    name: "Bytes",
    desc:
      "At the core, networking applications manipulate byte streams. Bytes provides a rich set of utilities for manipulating byte arrays.",
    zIndex: 1,
    href: "https://github.com/tokio-rs/bytes",
  },
];

export { STACK_LAYERS }
