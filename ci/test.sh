set -ex

if [ ! -d tmp ]; then
  cargo new tmp
  cat >> tmp/Cargo.toml <<-EOF
futures = "0.1"
futures-cpupool = "0.1"
tokio-core = "0.1"
tokio-proto = { git = "https://github.com/tokio-rs/tokio-proto" }
tokio-service = { git = "https://github.com/tokio-rs/tokio-service" }
tokio-timer = { git = "https://github.com/tokio-rs/tokio-timer" }
tokio-tls = "0.1"
EOF
  cargo build --manifest-path tmp/Cargo.toml
fi

for f in `git ls-files | grep 'md$'`; do
  echo $f
  rustdoc --test $f -L tmp/target/debug/deps
done
