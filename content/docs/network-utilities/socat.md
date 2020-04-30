---
title: "socat"
weight: 9200
menu:
  docs:
    parent: network_utils
---

[socat](http://www.dest-unreach.org/socat/) provides the ability to redirect
input and outputs. See [install instructions](#how-to-install) with links below for quick references on getting set up on most operating systems.

## How it works

First a quick introduction to `socat`...

![socat lets you proxy basically any 2 things. Basic syntax: socat thing1 thing2, socat supports tcp sockets, unix domain sockets, pipes, SSL sockets, files, processes, UDP sockets and more!](/img/external/socat-julia-evans.jpeg)

(c) 2018 Julia Evans, for more programming zines and comics, see [wizardzines.com/](https://wizardzines.com/)

Examples in the comic included as text in our *cheat sheet* below for easy copy/paste.

## Cheat sheet

`-v` option provides verbose output to stdout which is very useful for debugging

### TCP proxy
Proxy from local HTTP port to remote server:
```
socat -v TCP-LISTEN:1337 TCP:example.com:80
```
now if you go to localhost:1337 you will see a response from http://example.com
(though the Host field is incorrect, so you get a 404).  A deep dive into HTTP
is outside of the scope of this socat cheat sheet, but you can test this with
`curl --resolve example.com:80:localhost:1334 example.com`.

### SSL
In real life, most servers will require SSL, which can be added on 
(where `verify=0` won't check the SSL cert, which is fine for most debug /
learning use cases).

socat -v TCP-LISTEN:1337 ssl:example.com:80,verify=0

### Unix domain socket
expose a [unix domain socket](http://man7.org/linux/man-pages/man7/unix.7.html) on port 1337
```
socat TCP-LISTEN:1337 UNIX-CONNECT:/path
```



## How to install

### Debian / Ubuntu Linux

```bash
sudo apt-get update && sudo apt-get install socat
```

### Arch Linux
```bash
sudo pacman -S socat
```

### Fedora, CentOS, RedHat

```bash
sudo yum install socat
```

### Mac Homebrew

```bash
brew install socat
```

### Windows

[download](https://sourceforge.net/projects/unix-utils/files/socat/)


