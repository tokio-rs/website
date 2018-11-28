---
title: "Using AsyncRead and AsyncWrite directly"
weight : 3030
menu:
  docs:
    parent: io
---

From doc-push plan:

```text
Using the poll_ based APIs for reading and writing data. This page talks
about the lower level API and explains how the combinators described on
the previous page work. There should be plenty of examples.

Contents

    Dig more into AsyncReady trait.
        poll_read function.
            Tie in with runtime model.
        Disclaimer: AsyncRead extends std::io::Read... mistake
        When to use poll_read vs. combinators? (quick answer then link to combinator vs/ manual future impl discussion).
        Example: implement ReadExact.

    Dig into AsyncWrite trait.
        poll_write function
        poll_flush function.
        shutdown function
            In std, blocking cleanup ops are done in drop handler.
            shutdown performs this work, like flushing.
            Socket is safely dropped after shutdown returns Ok(Ready).
            Sometimes it isn't possible:
                Alternative: spawn task w/ socket to do cleanup work.
```
