#!/bin/sh
set -ex

if [ ! -d tmp ]; then
  cargo new tmp
  cat >> tmp/Cargo.toml <<-EOF
futures = "0.1.18"
tokio = "0.1.5"
EOF
  cargo build --manifest-path tmp/Cargo.toml
fi

rand=$(ls tmp/target/debug/deps/librand-*.rlib | head -1)
echo $rand
for f in $(git ls-files | grep 'md$' | grep -v 'legacy'); do
  echo "$f"
  rustdoc --test "$f" -L tmp/target/debug/deps --extern "rand=$rand"
done
