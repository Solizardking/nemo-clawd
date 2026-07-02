#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Nemo Clawd walkthrough — sandboxed agent approval flow.
#
# This sets up a split-screen workflow:
#   LEFT:  Nemo Clawd agent (chat)
#   RIGHT: OpenShell TUI (monitor + approve network egress)
#
# The agent runs inside a sandboxed environment with a strict network
# policy. When it tries to access a service not in the allow list,
# the TUI prompts the operator to approve or deny the request.
#
# Prerequisites:
#   - Nemo Clawd setup complete (./scripts/setup.sh)
#   - ZAI_API_KEY in environment for GLM 5.2, or NVIDIA_API_KEY for fallback inference
#
# Suggested prompts that trigger the approval flow:
#
#   1. "Write a Python script that fetches the current NVIDIA stock price
#       and prints it." → triggers PyPI (pip install) + finance API access
#
#   2. "Search the web for the latest MLPerf inference benchmarks and
#       summarize them." → triggers web search API access
#
#   3. "Install the requests library and fetch the top story from
#       Hacker News." → triggers PyPI + news.ycombinator.com access
#
# Usage:
#   ./scripts/walkthrough.sh
#
# This opens two panes in tmux. If tmux is not available, run manually:
#
#   Terminal 1 (TUI):
#     openshell term
#
#   Terminal 2 (Agent):
#     openshell sandbox connect nemoclawd
#     export ZAI_API_KEY=...
#     nemoclawd-start
#     nemoclawd agent --agent main --local --session-id live

set -euo pipefail

if [ -n "${ZAI_API_KEY:-}" ]; then
  INFERENCE_KEY_NAME="ZAI_API_KEY"
  INFERENCE_KEY_VALUE="$ZAI_API_KEY"
elif [ -n "${NVIDIA_API_KEY:-}" ]; then
  INFERENCE_KEY_NAME="NVIDIA_API_KEY"
  INFERENCE_KEY_VALUE="$NVIDIA_API_KEY"
else
  echo "ZAI_API_KEY or NVIDIA_API_KEY required"
  exit 1
fi
printf -v INFERENCE_EXPORT '%s=%q' "$INFERENCE_KEY_NAME" "$INFERENCE_KEY_VALUE"

echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │  Nemo Clawd Walkthrough                               │"
echo "  │                                                     │"
echo "  │  LEFT pane:   OpenShell TUI (monitor + approve)     │"
echo "  │  RIGHT pane:  Nemo Clawd agent (chat)                 │"
echo "  │                                                     │"
echo "  │  When the agent tries to access a new service,      │"
echo "  │  the TUI will prompt you to approve or deny.        │"
echo "  │                                                     │"
echo "  │  Try asking:                                        │"
echo "  │    \"Fetch the current NVIDIA stock price\"            │"
echo "  │    \"Install requests and get the top HN story\"       │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""

if ! command -v tmux > /dev/null 2>&1; then
  echo "tmux not found. Run these in two separate terminals:"
  echo ""
  echo "  Terminal 1 (TUI):"
  echo "    openshell term"
  echo ""
  echo "  Terminal 2 (Agent):"
  echo "    openshell sandbox connect nemoclawd"
  echo "    export $INFERENCE_EXPORT"
  echo "    nemoclawd-start"
  echo "    nemoclawd agent --agent main --local --session-id live"
  exit 0
fi

SESSION="nemoclawd-walkthrough"

# Kill old session if it exists
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create session with TUI on the left
tmux new-session -d -s "$SESSION" -x 200 -y 50 "openshell term"

# Split right pane for the agent
tmux split-window -h -t "$SESSION" \
  "openshell sandbox connect nemoclawd -- bash -lc 'export $INFERENCE_EXPORT && nemoclawd-start nemoclawd agent --agent main --local --session-id live'"

# Even split
tmux select-layout -t "$SESSION" even-horizontal

# Attach
tmux attach -t "$SESSION"
