+++
title = "Architecture Overview"
description = "An overview of the various Tokio coponents"
menu = "going_deeper"
weight = 90
+++

Most networking applications are structured in a layered fashion.

- **Byte streams** are at the lowest layer. This is usually provided by TCP or
  UDP sockets. At this layer, operations are made against byte arrays and
  usually done with buffers. Besides directly manipulating the socket, this is
  also where functionality like
  [TLS](https://en.wikipedia.org/wiki/Transport_Layer_Security) would reside.

* **Framing** is taking a raw stream of bytes and breaking it up into meaningful
  units. For example, an HTTP protocol could be framed into frames consisting of
  request head, response head, or body chunk. A line based protocol consists of
  `String` frames that are delineated by new line tokens. At this point, instead
  of dealing with a stream of raw bytes, we are dealing with a stream of frame
  values. In Tokio, we sometimes refer to a full duplex stream of frames as a
  **Transport**.

* A **request / response exchange** generally is where application logic starts
  appearing. At this layer, a request is issued and a response for the request
  is returned. When the request is issued, it is turned into one or more frames
  and written to a transport. Then, at some point in the future, a response to
  the request will be read from the transport, and matched with the original
  request.

* At the **application** layer, the details of how requests and responses are
  mapped onto a transport doesn't matter. A single application may be receiving
  and issuing requests for many different protocols. An HTTP server application
  will be receiving HTTP requests, and then in turn, issuing database requests
  or other HTTP requests.

Each of these layers tend to be implemented in different libraries, and the end
application will pull in the protocol implementations and just interact with
them at the request / response exchange layer.

Tokio's abstractions map on to these different layers.

## [Byte streams](#byte-streams) {#byte-streams}

Zomg

## [Framing](#framing) {#framing}

## [Request / Response](#request-response) {#request-response}

## [Application](#application) {#application}
