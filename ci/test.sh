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
tokio-minihttp = { git = "https://github.com/tokio-rs/tokio-minihttp" }
tokio-tls = "0.1"
rand = "0.3"
rustc-serialize = "0.3"
postgres = "0.13"
r2d2 = "0.7"
r2d2_postgres = "0.11"
EOF
  cargo build --manifest-path tmp/Cargo.toml
fi

rand=`ls tmp/target/debug/deps/librand-*.rlib`
for f in `git ls-files | grep 'md$'`; do
  echo $f
  rustdoc --test $f -L tmp/target/debug/deps --extern rand=$rand
done
