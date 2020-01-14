---
title: "telnet"
menu:
  docs:
    parent: network_utils
---
The word "telnet" often refers to the Telnet client, since the command to
run the client has the same name as the protocol. This page is about the
telnet client which we use in this guide to test and debug servers.

Telnet is a computer protocol that was built for interacting with remote
computers ([IETF RFC-854]: https://tools.ietf.org/html/rfc854).

Telnet utility allows users to test connectivity to remote machines and
issue commands through the use of a keyboard, and one of the simplest ways to
check if a port is open and listening on a network.

# How to install

## Debian / Ubuntu Linux

```bash
sudo apt-get update && sudo apt-get install telnet

```

## Fedora, CentOS, RedHat

```bash
sudo yum install telnet
```

## Mac Homebrew

```bash
brew install telnet
```

## Windows

[Install for CMD or PowerShell](https://www.shellhacks.com/windows-install-telnet-client-cmd-powershell/)