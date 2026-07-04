#!/usr/bin/env bash
# Test inference.local routing through OpenShell provider (local vLLM/remote GPU)
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: test-inference-local.sh [--dry-run]

Send a minimal chat completion request to inference.local using the local
vLLM/Nemotron model route. This is not the Jetson Orin Nano hosted route.

Environment:
  INFERENCE_URL  Override the endpoint URL.
  NEMOCLAWD_LOCAL_MODEL  Override the local vLLM model ID.

Options:
  --dry-run, --smoke-test  Print the request without calling the endpoint.
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

INFERENCE_URL="${INFERENCE_URL:-https://inference.local/v1/chat/completions}"
LOCAL_MODEL="${NEMOCLAWD_LOCAL_MODEL:-${VLLM_MODEL:-nvidia/nemotron-3-nano-30b-a3b}}"
TMP_BASE="${TMPDIR:-/tmp}"
TMP_BASE="${TMP_BASE%/}"
[ -n "$TMP_BASE" ] || TMP_BASE="/tmp"
REQUEST_FILE="$(mktemp "${TMP_BASE}/nemoclawd-inference-local.XXXXXX")"
cleanup() {
  rm -f "$REQUEST_FILE"
}
trap cleanup EXIT

printf '{"model":"%s","messages":[{"role":"user","content":"say hello"}]}\n' "$LOCAL_MODEL" > "$REQUEST_FILE"

if [ "$DRY_RUN" = true ]; then
  echo "Would POST $REQUEST_FILE to $INFERENCE_URL"
  cat "$REQUEST_FILE"
  exit 0
fi

curl -fsS "$INFERENCE_URL" -H "Content-Type: application/json" -d @"$REQUEST_FILE"
