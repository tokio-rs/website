#!/bin/sh
set -ex

if [ ! -d tmp ]; then
  cargo new tmp
  cat >> tmp/Cargo.toml <<-EOF
bytes = "0.4"
futures = "0.1"
futures-cpupool = "0.1"
postgres = "0.13"
r2d2 = "0.7"
r2d2_postgres = "0.11"
rand = "0.3"
serde = "1.0"
serde_derive = "1.0"
serde_json = "1.0"
tokio-core = "0.1"
tokio-io = "0.1"
tokio-minihttp = { git = "https://github.com/tokio-rs/tokio-minihttp" }
tokio-proto = "0.1"
tokio-service = "0.1"
tokio-timer = "0.1"
tokio-tls = "0.1"
EOF
  cargo build --manifest-path tmp/Cargo.toml
fi

rand=$(ls tmp/target/debug/deps/librand-*.rlib)
for f in $(git ls-files | grep 'md$'); do
  echo "$f"
  rustdoc --test "$f" -L tmp/target/debug/deps --extern "rand=$rand"
done
