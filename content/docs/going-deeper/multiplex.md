+++
title = "Multiplexed protocols"
description = ""
menu = "going_deeper"
weight = 105
+++

Multiplexing is a method by which many concurrent requests can be issued over a
single socket such that responses may be received in a different order than the
issued requests. This allows the server to begin processing requests as soon as
they are received and to respond to the client as soon as the request is
processed. Generally, multiplexed protocols will make better usage of available
resources like TCP sockets.

Since responses arrive out of order, a **request ID** is used to match
reesponses with their associated requests. When the client issues a request, the
request will be paired with an identifier. The server processes the request, and
sends a response to the client paired with the same request identifier. This
allows the client to receive the response and pair it with a request that it
issued.

{{< figure src="/img/diagrams/multiplexing.png"
caption="Flow of multiplexed requests and responses" >}}

Tokio makes implementing multiplexed clients and servers easy. This
guide will show how.

## [Overview](#overview) {#overview}
