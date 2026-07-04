#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Install the openshell CLI binary. Supports Linux and macOS (x86_64 and aarch64).

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install-openshell.sh [--dry-run]

Install the OpenShell CLI binary for the current OS and architecture.

Options:
  --dry-run, --smoke-test  Resolve the release asset without downloading it.
  -h, --help              Show this help.
EOF
}

DRY_RUN=false
case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
  --dry-run|--smoke-test)
    DRY_RUN=true
    ;;
  "")
    ;;
  *)
    usage >&2
    echo "Unknown argument: $1" >&2
    exit 2
    ;;
esac

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS/$ARCH" in
  Darwin/x86_64|Darwin/amd64)   ASSET="openshell-x86_64-apple-darwin.tar.gz" ;;
  Darwin/aarch64|Darwin/arm64)  ASSET="openshell-aarch64-apple-darwin.tar.gz" ;;
  Linux/x86_64|Linux/amd64)     ASSET="openshell-x86_64-unknown-linux-musl.tar.gz" ;;
  Linux/aarch64|Linux/arm64)    ASSET="openshell-aarch64-unknown-linux-musl.tar.gz" ;;
  *) echo "Unsupported platform: $OS/$ARCH"; exit 1 ;;
esac

if [ "$DRY_RUN" = true ]; then
  echo "Would install OpenShell asset: $ASSET"
  exit 0
fi

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

curl -fsSL "https://github.com/NVIDIA/OpenShell/releases/latest/download/$ASSET" \
  -o "$tmpdir/openshell.tar.gz"
tar xzf "$tmpdir/openshell.tar.gz" -C "$tmpdir"

if [ -w /usr/local/bin ]; then
  install -m 755 "$tmpdir/openshell" /usr/local/bin/openshell
else
  sudo install -m 755 "$tmpdir/openshell" /usr/local/bin/openshell
fi

echo "openshell $(openshell --version 2>&1 || echo 'installed')"
