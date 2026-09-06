# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/devcontainers/base:1-bookworm@sha256:ce2e9e611939e611b737362c045bb6d3449bb3efb84898525d724aace1737b90

ARG TARGETARCH
ARG NODE_VERSION=24.19.0
ARG NPM_VERSION=11.17.0
ARG RUST_VERSION=1.97.1

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
        at-spi2-core \
        build-essential \
        ca-certificates \
        curl \
        dbus-x11 \
        libayatana-appindicator3-dev \
        libdbus-1-dev \
        librsvg2-dev \
        libssl-dev \
        libwebkit2gtk-4.1-dev \
        patchelf \
        pkg-config \
        python3-pip \
        python3-venv \
        xauth \
        xdotool \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) node_arch="x64"; node_sha="14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647" ;; \
      arm64) node_arch="arm64"; node_sha="01443c1e1a29e531ccad5a46fefa6df490d2189c49f7955904aecdbb0fe86fdc" ;; \
      *) echo "Unsupported devcontainer architecture: $TARGETARCH" >&2; exit 2 ;; \
    esac; \
    archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"; \
    curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
      --output "/tmp/${archive}" "https://nodejs.org/dist/v${NODE_VERSION}/${archive}"; \
    echo "${node_sha}  /tmp/${archive}" | sha256sum --check --strict; \
    tar --extract --xz --file "/tmp/${archive}" --directory /usr/local --strip-components=1; \
    rm "/tmp/${archive}"; \
    test "$(node --version)" = "v${NODE_VERSION}"; \
    test "$(npm --version)" = "${NPM_VERSION}"

RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) rust_target="x86_64-unknown-linux-gnu"; rust_sha="88f28fa9af20594179f85d6df67078dfd6fa93e2f6da5e1e9b0ac4997988ca4f" ;; \
      arm64) rust_target="aarch64-unknown-linux-gnu"; rust_sha="9a7a2c336b4787f1b72f6bab7c35d5b7af2fd03cbd39b4fc721466a70d402a7d" ;; \
      *) echo "Unsupported devcontainer architecture: $TARGETARCH" >&2; exit 2 ;; \
    esac; \
    archive="rust-${RUST_VERSION}-${rust_target}.tar.xz"; \
    curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
      --output "/tmp/${archive}" "https://static.rust-lang.org/dist/${archive}"; \
    echo "${rust_sha}  /tmp/${archive}" | sha256sum --check --strict; \
    mkdir "/tmp/rust-${RUST_VERSION}"; \
    tar --extract --xz --file "/tmp/${archive}" --directory "/tmp/rust-${RUST_VERSION}" --strip-components=1; \
    "/tmp/rust-${RUST_VERSION}/install.sh" --prefix=/usr/local --disable-ldconfig; \
    rm -rf "/tmp/${archive}" "/tmp/rust-${RUST_VERSION}"; \
    rustc --version | grep --fixed-strings "rustc ${RUST_VERSION} "; \
    cargo clippy --version; \
    cargo fmt --version

USER vscode
