#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Nemo Clawd installer — installs Node.js, Ollama (if GPU present), and Nemo Clawd.

set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[1;32m[DONE]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*"; exit 1; }

command_exists() { command -v "$1" &>/dev/null; }

MIN_NODE_MAJOR=20
MIN_NPM_MAJOR=10
RECOMMENDED_NODE_MAJOR=22
NPM_PACKAGE="@mawdbotsonsolana/nemoclawd"
RUNTIME_REQUIREMENT_MSG="Nemo Clawd requires Node.js >=${MIN_NODE_MAJOR} and npm >=${MIN_NPM_MAJOR} (recommended Node.js ${RECOMMENDED_NODE_MAJOR})."
TOTAL_STEPS=6
CURRENT_STEP=0
FUN_LINES=(
  "tuning the command deck"
  "warming the sandbox"
  "stacking clean dependencies"
  "checking the launch clamps"
  "sorting the sharp edges"
  "teaching npm the route"
  "polishing the CLI handle"
  "loading the onboarding console"
  "keeping secrets out of logs"
  "packing extra terminal sparkle"
)

supports_animation() {
  [[ -t 1 && -z "${CI:-}" && -z "${NEMOCLAWD_NO_ANIMATION:-}" ]]
}

frame_sleep() {
  sleep 0.08 2>/dev/null || sleep 1
}

fun_line() {
  local index="$1"
  printf '%s' "${FUN_LINES[$(( index % ${#FUN_LINES[@]} ))]}"
}

print_banner() {
  if ! supports_animation; then
    info "=== Nemo Clawd Installer ==="
    info "Set NEMOCLAWD_NO_ANIMATION=1 for plain logs or NEMOCLAWD_VERBOSE=1 for full command output."
    return
  fi

  printf '\033[1;36m'
  cat <<'EOF'
    ███╗   ██╗███████╗███╗   ███╗ ██████╗  ██████╗██╗      █████╗ ██╗    ██╗██████╗
    ████╗  ██║██╔════╝████╗ ████║██╔═══██╗██╔════╝██║     ██╔══██╗██║    ██║██╔══██╗
    ██╔██╗ ██║█████╗  ██╔████╔██║██║   ██║██║     ██║     ███████║██║ █╗ ██║██║  ██║
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██║   ██║██║     ██║     ██╔══██║██║███╗██║██║  ██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║╚██████╔╝╚██████╗███████╗██║  ██║╚███╔███╔╝██████╔╝
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝ ╚═════╝  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝
             🦞  Solana × xAI  |  Agentic Trading Engine  |  $CLAWD  🦞
EOF
  printf '\033[0m'

  local frames=("booting launchpad" "warming prompts" "counting tokens" "arming sandbox" "opening the hatch" "ready")
  local frame
  for frame in "${frames[@]}"; do
    printf '\r\033[K\033[1;36m[setup]\033[0m %-24s %s' "$frame" ">>>>>"
    frame_sleep
    frame_sleep
  done
  printf '\r\033[K'

  printf '  \033[1;35mmission\033[0m  Install Node.js %s+, npm %s+, and %s\n' "$MIN_NODE_MAJOR" "$MIN_NPM_MAJOR" "$NPM_PACKAGE"
  printf '  \033[1;35mmode\033[0m     Animated terminal, plain logs everywhere else\n\n'
  info "Nemo Clawd installer"
  info "Set NEMOCLAWD_NO_ANIMATION=1 for plain logs or NEMOCLAWD_VERBOSE=1 for full command output."
}

draw_step_bar() {
  local label="$1"
  local width=24
  local previous=$(( (CURRENT_STEP - 1) * width / TOTAL_STEPS ))
  local filled=$(( CURRENT_STEP * width / TOTAL_STEPS ))
  local bar=""
  local i progress empty

  for ((progress = previous + 1; progress <= filled; progress++)); do
    bar=""
    empty=$(( width - progress ))
    for ((i = 0; i < progress; i++)); do bar+="#"; done
    for ((i = 0; i < empty; i++)); do bar+="."; done
    printf '\r\033[K\033[1;35m[%d/%d]\033[0m [%s] %s' "$CURRENT_STEP" "$TOTAL_STEPS" "$bar" "$label"
    frame_sleep
  done

  printf '\n'
}

stage() {
  CURRENT_STEP=$(( CURRENT_STEP + 1 ))
  local label="$1"

  if supports_animation; then
    draw_step_bar "$label"
  else
    info "[$CURRENT_STEP/$TOTAL_STEPS] $label"
  fi
}

run_with_spinner() {
  local label="$1"
  shift

  if ! supports_animation || [[ "${NEMOCLAWD_VERBOSE:-}" == "1" ]]; then
    info "$label"
    "$@"
    ok "$label"
    return 0
  fi

  local log_file pid status tick frame detail
  local frames=(">" ">>" ">>>" ">>>>" ">>>" ">>" ">")
  log_file="$(mktemp "${TMPDIR:-/tmp}/nemoclawd-install.XXXXXX")"

  "$@" >"$log_file" 2>&1 &
  pid=$!
  tick=0

  while kill -0 "$pid" 2>/dev/null; do
    frame="${frames[$(( tick % ${#frames[@]} ))]}"
    detail="$(fun_line "$tick")"
    printf '\r\033[K\033[1;36m[%-4s]\033[0m %-46s \033[2m%s\033[0m' "$frame" "$label" "$detail"
    frame_sleep
    tick=$(( tick + 1 ))
  done

  if wait "$pid"; then
    printf '\r\033[K\033[1;32m[ok]\033[0m %s\n' "$label"
    rm -f "$log_file"
    return 0
  fi

  status=$?
  printf '\r\033[K\033[1;31m[fail]\033[0m %s\n' "$label" >&2
  warn "Last 40 lines from $label:"
  tail -n 40 "$log_file" >&2 || true
  rm -f "$log_file"
  return "$status"
}

finish_animation() {
  if supports_animation; then
    local frame burst
    local bursts=(
      "[*........]"
      "[.*.......]"
      "[..*......]"
      "[...*.....]"
      "[....*....]"
      "[.....*...]"
      "[......*..]"
      "[.......*.]"
      "[........*]"
      "[*..*..*.*]"
    )
    for frame in "linking shortcuts" "syncing shell notes" "lighting the dashboard" "opening the control room"; do
      burst="${bursts[$(( RANDOM % ${#bursts[@]} ))]}"
      printf '\r\033[K\033[1;32m[finish]\033[0m %-28s \033[1;36m%s\033[0m' "$frame" "$burst"
      frame_sleep
      frame_sleep
    done
    printf '\r\033[K'
    printf '\033[1;32m'
    cat <<'EOF'
    ███╗   ███╗███████╗███╗   ███╗ ██████╗     ██████╗██╗      █████╗ ██╗    ██╗██████╗
    ████╗ ████║██╔════╝████╗ ████║██╔═══██╗   ██╔════╝██║     ██╔══██╗██║    ██║██╔══██╗
    ██╔████╔██║█████╗  ██╔████╔██║██║   ██║   ██║     ██║     ███████║██║ █╗ ██║██║  ██║
    ██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██║   ██║   ██║     ██║     ██╔══██║██║███╗██║██║  ██║
    ██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║╚██████╔╝   ╚██████╗███████╗██║  ██║╚███╔███╔╝██████╔╝
    ╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝    ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝
              🦞  NEMO CLAWD READY  —  Solana × xAI  |  $CLAWD  🦞
EOF
    printf '\033[0m'
  fi

  ok "Installation complete"
}

# Compare two semver strings (major.minor.patch). Returns 0 if $1 >= $2.
version_gte() {
  local IFS=.
  local -a a=($1) b=($2)
  for i in 0 1 2; do
    local ai=${a[$i]:-0} bi=${b[$i]:-0}
    if (( ai > bi )); then return 0; fi
    if (( ai < bi )); then return 1; fi
  done
  return 0
}

# Ensure nvm environment is loaded in the current shell.
ensure_nvm_loaded() {
  if [[ -z "${NVM_DIR:-}" ]]; then
    export NVM_DIR="$HOME/.nvm"
  fi
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    \. "$NVM_DIR/nvm.sh"
  fi
}

# Refresh PATH so that npm global bin is discoverable.
# After nvm installs Node.js the global bin lives under the nvm prefix,
# which may not yet be on PATH in the current session.
refresh_path() {
  ensure_nvm_loaded

  local npm_bin
  npm_bin="$(npm config get prefix 2>/dev/null)/bin" || true
  if [[ -n "$npm_bin" && -d "$npm_bin" && ":$PATH:" != *":$npm_bin:"* ]]; then
    export PATH="$npm_bin:$PATH"
  fi
}

version_major() {
  printf '%s\n' "${1#v}" | cut -d. -f1
}

ensure_supported_runtime() {
  command_exists node || error "${RUNTIME_REQUIREMENT_MSG} Node.js was not found on PATH."
  command_exists npm || error "${RUNTIME_REQUIREMENT_MSG} npm was not found on PATH."

  local node_version npm_version node_major npm_major
  node_version="$(node --version 2>/dev/null || true)"
  npm_version="$(npm --version 2>/dev/null || true)"
  node_major="$(version_major "$node_version")"
  npm_major="$(version_major "$npm_version")"

  [[ "$node_major" =~ ^[0-9]+$ ]] || error "Could not determine Node.js version from '${node_version}'. ${RUNTIME_REQUIREMENT_MSG}"
  [[ "$npm_major" =~ ^[0-9]+$ ]] || error "Could not determine npm version from '${npm_version}'. ${RUNTIME_REQUIREMENT_MSG}"

  if (( node_major < MIN_NODE_MAJOR || npm_major < MIN_NPM_MAJOR )); then
    error "Unsupported runtime detected: Node.js ${node_version:-unknown}, npm ${npm_version:-unknown}. ${RUNTIME_REQUIREMENT_MSG} Upgrade Node.js and rerun the installer."
  fi

  info "Runtime OK: Node.js ${node_version}, npm ${npm_version}"
}

# ---------------------------------------------------------------------------
# 1. Node.js
# ---------------------------------------------------------------------------
install_nodejs() {
  if command_exists node; then
    info "Node.js found: $(node --version)"
    return
  fi

  info "Node.js not found — installing via nvm…"
  # IMPORTANT: update NVM_SHA256 when changing NVM_VERSION
  local NVM_VERSION="v0.40.4"
  local NVM_SHA256="4b7412c49960c7d31e8df72da90c1fb5b8cccb419ac99537b737028d497aba4f"
  local nvm_tmp
  nvm_tmp="$(mktemp)"
  run_with_spinner "Downloading nvm ${NVM_VERSION}" curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" -o "$nvm_tmp" \
    || { rm -f "$nvm_tmp"; error "Failed to download nvm installer"; }
  local actual_hash
  if command_exists sha256sum; then
    actual_hash="$(sha256sum "$nvm_tmp" | awk '{print $1}')"
  elif command_exists shasum; then
    actual_hash="$(shasum -a 256 "$nvm_tmp" | awk '{print $1}')"
  else
    warn "No SHA-256 tool found — skipping nvm integrity check"
    actual_hash="$NVM_SHA256"  # allow execution
  fi
  if [[ "$actual_hash" != "$NVM_SHA256" ]]; then
    rm -f "$nvm_tmp"
    error "nvm installer integrity check failed\n  Expected: $NVM_SHA256\n  Actual:   $actual_hash"
  fi
  info "nvm installer integrity verified"
  run_with_spinner "Installing nvm" bash "$nvm_tmp"
  rm -f "$nvm_tmp"
  ensure_nvm_loaded
  run_with_spinner "Installing Node.js 22 with nvm" nvm install 22
  info "Node.js installed: $(node --version)"
}

# ---------------------------------------------------------------------------
# 2. Ollama
# ---------------------------------------------------------------------------
OLLAMA_MIN_VERSION="0.18.0"

get_ollama_version() {
  # `ollama --version` outputs something like "ollama version 0.18.0"
  ollama --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
}

detect_gpu() {
  # Returns 0 if a GPU is detected
  if command_exists nvidia-smi; then
    nvidia-smi &>/dev/null && return 0
  fi
  return 1
}

get_vram_mb() {
  # Returns total VRAM in MiB (NVIDIA only). Falls back to 0.
  if command_exists nvidia-smi; then
    nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null \
      | awk '{s += $1} END {print s+0}'
    return
  fi
  # macOS — report unified memory as VRAM
  if [[ "$(uname -s)" == "Darwin" ]] && command_exists sysctl; then
    local bytes
    bytes=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    echo $(( bytes / 1024 / 1024 ))
    return
  fi
  echo 0
}

install_or_upgrade_ollama() {
  if detect_gpu && command_exists ollama; then
    local current
    current=$(get_ollama_version)
    if [[ -n "$current" ]] && version_gte "$current" "$OLLAMA_MIN_VERSION"; then
      info "Ollama v${current} meets minimum requirement (>= v${OLLAMA_MIN_VERSION})"
    else
      info "Ollama v${current:-unknown} is below v${OLLAMA_MIN_VERSION} — upgrading…"
      curl -fsSL https://ollama.com/install.sh | sh
      info "Ollama upgraded to $(get_ollama_version)"
    fi
  else
    # No ollama — only install if a GPU is present
    if detect_gpu; then
      info "GPU detected — installing Ollama…"
      curl -fsSL https://ollama.com/install.sh | sh
      info "Ollama installed: v$(get_ollama_version)"
    else
      warn "No GPU detected — skipping Ollama installation."
      return
    fi
  fi

  # Pull the appropriate model based on VRAM
  local vram_mb
  vram_mb=$(get_vram_mb)
  local vram_gb=$(( vram_mb / 1024 ))
  info "Detected ${vram_gb} GB VRAM"

  if (( vram_gb >= 120 )); then
    info "Pulling nemotron-3-super:120b…"
    ollama pull nemotron-3-super:120b
  else
    info "Pulling nemotron-3-nano:30b…"
    ollama pull nemotron-3-nano:30b
  fi
}

# ---------------------------------------------------------------------------
# 3. Nemo Clawd
# ---------------------------------------------------------------------------
install_nemoclawd() {
  local local_package_name=""
  if [[ -f "./package.json" ]]; then
    local_package_name="$(node -p "try { require('./package.json').name } catch { '' }" 2>/dev/null || true)"
  fi

  if [[ "$local_package_name" == "$NPM_PACKAGE" ]]; then
    info "Nemo Clawd package.json found in current directory — installing from source…"
    run_with_spinner "Installing local npm dependencies" npm install
    run_with_spinner "Linking local nemoclawd CLI" npm link
  else
    run_with_spinner "Installing Nemo Clawd from npm (${NPM_PACKAGE})" npm install -g "$NPM_PACKAGE"
  fi

  refresh_path
}

# ---------------------------------------------------------------------------
# 4. Verify
# ---------------------------------------------------------------------------
verify_nemoclawd() {
  if command_exists nemoclawd; then
    info "Verified: nemoclawd is available at $(command -v nemoclawd)"
    return 0
  fi

  # nemoclawd not on PATH — try to diagnose and suggest a fix
  warn "nemoclawd is not on PATH after installation."

  local npm_bin
  npm_bin="$(npm config get prefix 2>/dev/null)/bin" || true

  if [[ -n "$npm_bin" && -x "$npm_bin/nemoclawd" ]]; then
    warn "Found nemoclawd at $npm_bin/nemoclawd but that directory is not on PATH."
    warn ""
    warn "Add it to your shell profile:"
    warn "  echo 'export PATH=\"$npm_bin:\$PATH\"' >> ~/.bashrc"
    warn "  source ~/.bashrc"
    warn ""
    warn "Or for zsh:"
    warn "  echo 'export PATH=\"$npm_bin:\$PATH\"' >> ~/.zshrc"
    warn "  source ~/.zshrc"
    warn ""
    warn "Continuing — nemoclawd is installed but requires a PATH update."
    return 0
  else
    warn "Could not locate the nemoclawd executable."
    warn "Try running:  npm install -g ${NPM_PACKAGE}"
  fi

  error "Installation failed: nemoclawd binary not found."
}

# ---------------------------------------------------------------------------
# 5. Onboard
# ---------------------------------------------------------------------------
run_onboard() {
  info "Opening the nemoclawd onboarding wizard..."
  nemoclawd onboard
}

# ---------------------------------------------------------------------------
# 6. Post-install message
# ---------------------------------------------------------------------------
post_install_message() {
  # Only show shell reload instructions when Node was installed via a
  # version manager that modifies PATH in shell profile files.
  # nvm and fnm require sourcing the profile; nodesource/brew install to
  # system paths already on PATH.
  if [[ ! -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    return 0
  fi

  local profile="$HOME/.bashrc"
  if [[ -n "${ZSH_VERSION:-}" ]] || [[ "$(basename "${SHELL:-}")" == "zsh" ]]; then
    profile="$HOME/.zshrc"
  elif [[ ! -f "$HOME/.bashrc" && -f "$HOME/.profile" ]]; then
    profile="$HOME/.profile"
  fi

  echo ""
  echo "  ──────────────────────────────────────────────────"
  warn "Your current shell may not have the updated PATH."
  echo ""
  echo "  To use nemoclawd now, run:"
  echo ""
  echo "    source $profile"
  echo ""
  echo "  Or open a new terminal window."
  echo "  ──────────────────────────────────────────────────"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  print_banner

  stage "Prepare Node.js"
  install_nodejs
  stage "Validate runtime"
  ensure_supported_runtime
  stage "Install Nemo Clawd CLI"
  # install_or_upgrade_ollama
  install_nemoclawd
  stage "Verify CLI"
  verify_nemoclawd
  stage "Show shell notes"
  post_install_message
  stage "Start onboarding"
  run_onboard

  finish_animation
}

main "$@"
