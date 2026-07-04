#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Nemo Clawd setup for NVIDIA Jetson Orin Nano devices.
#
# This is the single-device Jetson path. It prepares Docker for OpenShell's
# k3s-in-Docker gateway and installs the OpenShell CLI if needed. It does not
# configure DGX Spark clustering, RoCE, vLLM tensor parallelism, or Spark
# community Docker recipes.
#
# Usage:
#   sudo nemoclawd setup-orin-nano
#   # or directly:
#   sudo bash scripts/setup-orin-nano.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}>>>${NC} $1"; }
warn() { echo -e "${YELLOW}>>>${NC} $1"; }
fail() { echo -e "${RED}>>>${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false

usage() {
  cat <<'EOF'
Usage: setup-orin-nano.sh [--dry-run]

Prepare a Jetson Orin Nano host for Nemo Clawd + OpenShell:
  - verify Linux/aarch64 host shape
  - add the login user to the docker group
  - configure Docker cgroupns=host for OpenShell's k3s-in-Docker gateway
  - install OpenShell CLI when it is missing
  - print the hosted Nemotron onboarding commands

Options:
  --dry-run, --smoke-test  Print detected host state without changing it.
  -h, --help              Show this help.
EOF
}

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
    fail "Unknown argument: $1"
    ;;
esac

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Linux" ]; then
  if [ "$DRY_RUN" = true ]; then
    warn "Dry run on $OS: actual setup is only for Jetson Orin Nano Linux hosts."
  else
    fail "This script is for Jetson Orin Nano Linux hosts. Use 'nemoclawd onboard' on macOS."
  fi
fi

case "$ARCH" in
  aarch64|arm64) ;;
  *)
    if [ "$DRY_RUN" = true ]; then
      warn "Expected aarch64/arm64 for Jetson Orin Nano, detected '$ARCH'."
    else
      fail "Expected aarch64/arm64 for Jetson Orin Nano, detected '$ARCH'."
    fi
    ;;
esac

JETSON_MODEL=""
if [ -r /proc/device-tree/model ]; then
  JETSON_MODEL="$(tr -d '\0' < /proc/device-tree/model 2>/dev/null || true)"
fi

if [ -n "$JETSON_MODEL" ]; then
  info "Detected platform: $JETSON_MODEL"
  if ! printf '%s' "$JETSON_MODEL" | grep -qi 'Jetson.*Orin Nano'; then
    if [ "$DRY_RUN" = true ]; then
      warn "This does not look like Jetson Orin Nano."
    else
      fail "This does not look like Jetson Orin Nano. Use the hardware-specific setup path for this device."
    fi
  fi
elif [ "$OS" = "Linux" ]; then
  if [ "$DRY_RUN" = true ]; then
    warn "Could not read /proc/device-tree/model."
  else
    fail "Could not verify Jetson Orin Nano from /proc/device-tree/model."
  fi
fi

if [ "$DRY_RUN" = true ]; then
  info "Host: $OS/$ARCH"
  info "Dry run: would configure docker group, Docker cgroupns=host, and OpenShell CLI."
  command -v docker >/dev/null 2>&1 && info "Docker: $(docker --version)" || warn "Docker CLI not found"
  command -v node >/dev/null 2>&1 && info "Node.js: $(node --version)" || warn "Node.js not found"
  command -v npm >/dev/null 2>&1 && info "npm: $(npm --version)" || warn "npm not found"
  command -v openshell >/dev/null 2>&1 && info "OpenShell: $(openshell --version 2>&1 || echo installed)" || warn "OpenShell not found"
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  fail "Must run as root: sudo nemoclawd setup-orin-nano"
fi

REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo "")}"
if [ -z "$REAL_USER" ]; then
  warn "Could not detect non-root user. Docker group will not be configured."
fi

command -v docker >/dev/null 2>&1 || fail "Docker CLI not found. Install Docker for your JetPack release, then rerun this script."

if [ -n "$REAL_USER" ]; then
  if id -nG "$REAL_USER" | grep -qw docker; then
    info "User '$REAL_USER' already in docker group"
  else
    info "Adding '$REAL_USER' to docker group..."
    usermod -aG docker "$REAL_USER"
    info "Added. Group will take effect on next login, or with 'newgrp docker'."
  fi
fi

DAEMON_JSON="/etc/docker/daemon.json"
NEEDS_RESTART=false

if [ -f "$DAEMON_JSON" ]; then
  CURRENT_MODE="$(python3 -c "import json; print(json.load(open('$DAEMON_JSON')).get('default-cgroupns-mode',''))" 2>/dev/null || echo "")"
  if [ "$CURRENT_MODE" = "host" ]; then
    info "Docker daemon already configured for cgroupns=host"
  else
    info "Updating Docker daemon cgroupns mode to 'host'..."
    python3 -c "
import json
try:
    with open('$DAEMON_JSON') as f:
        d = json.load(f)
except Exception:
    d = {}
d['default-cgroupns-mode'] = 'host'
with open('$DAEMON_JSON', 'w') as f:
    json.dump(d, f, indent=2)
"
    NEEDS_RESTART=true
  fi
else
  info "Creating Docker daemon config with cgroupns=host..."
  mkdir -p "$(dirname "$DAEMON_JSON")"
  printf '{\n  "default-cgroupns-mode": "host"\n}\n' > "$DAEMON_JSON"
  NEEDS_RESTART=true
fi

if [ "$NEEDS_RESTART" = true ]; then
  info "Restarting Docker daemon..."
  systemctl restart docker
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if docker info >/dev/null 2>&1; then
      break
    fi
    [ "$i" -eq 10 ] && fail "Docker did not come back after restart. Check 'systemctl status docker'."
    sleep 2
  done
  info "Docker restarted with cgroupns=host"
fi

if command -v openshell >/dev/null 2>&1; then
  info "OpenShell already installed: $(openshell --version 2>&1 || echo installed)"
else
  info "Installing OpenShell CLI..."
  bash "$SCRIPT_DIR/install-openshell.sh"
fi

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
  if [ "$NODE_MAJOR" -lt 20 ] 2>/dev/null; then
    warn "Node.js $(node --version) detected. Nemo Clawd requires Node.js >=20; Node.js 22 is recommended."
  else
    info "Node.js runtime OK: $(node --version), npm $(npm --version)"
  fi
else
  warn "Node.js/npm not found. Install Node.js 22 before running 'nemoclawd onboard'."
  warn "Example: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"
fi

echo ""
info "Jetson Orin Nano host preparation complete."
info "Next steps:"
echo "  export NVIDIA_API_KEY=\"nvapi-...\""
echo "  nemoclawd onboard"
echo "  openshell inference set --no-verify --provider nvidia-nim --model nvidia/nemotron-3-ultra-550b-a55b"
echo ""
info "For the full guide, see docs/deployment/set-up-orin-nano.md"
