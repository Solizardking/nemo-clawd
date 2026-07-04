---
title:
  page: "Set Up Nemo Clawd on Jetson Orin Nano"
  nav: "Set Up Orin Nano"
description: "Install Nemo Clawd on NVIDIA Jetson Orin Nano, use hosted Nemotron inference, and avoid DGX Spark-only deployment steps."
keywords: ["nemoclawd jetson orin nano", "nemotron orin nano", "openshell jetson"]
topics: ["generative_ai", "ai_agents"]
tags: ["nemoclawd", "jetson", "orin_nano", "openshell", "inference_routing"]
content:
  type: how_to
  difficulty: intermediate
  audience: ["developer", "engineer"]
status: published
---

<!--
  SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
  SPDX-License-Identifier: Apache-2.0
-->

# Set Up Nemo Clawd on Jetson Orin Nano

Use this path for a single NVIDIA Jetson Orin Nano or Orin Nano Super Developer Kit.
Do not use the DGX Spark cluster instructions for Orin Nano: those steps assume four DGX Spark nodes, ConnectX/RoCE networking, and tensor-parallel vLLM serving for a model that does not fit on a single Orin Nano.

The recommended Orin Nano architecture is:

```text
Jetson Orin Nano
  -> Ubuntu / JetPack
  -> Docker + OpenShell gateway
  -> Nemo Clawd sandbox
  -> hosted Nemotron or small local Ollama model
```

## What Runs Where

| Workload | Recommended on Orin Nano | Notes |
|---|---|---|
| Nemo Clawd sandbox and tools | Local | Run the agent runtime, Solana tools, network policy, and operator approval loop on the Jetson. |
| Nemotron 3 Ultra 550B | Hosted | Use NVIDIA NIM or OpenRouter. Do not try to serve this locally on Orin Nano. |
| Nemotron 3 Nano Omni 30B-A3B | Remote GPU or hosted endpoint | The "Nano" name is the model family, not a Jetson Nano target. The BF16, FP8, and NVFP4 checkpoints still exceed a practical single Orin Nano setup. |
| Small local models | Optional local | Use Ollama for local/offline fallback when latency, privacy, or disconnected operation matters more than model quality. |

## Prerequisites

- Jetson Orin Nano Developer Kit or Jetson Orin Nano Super Developer Kit.
- JetPack installed and booted. For JetPack 7.2, NVIDIA's Orin Nano quick start uses a Jetson ISO USB installer and installs Jetson Linux onto a microSD card or NVMe SSD. NVMe is strongly recommended for model caches, containers, and logs.
- Network access from the Jetson.
- An NVIDIA API key from [build.nvidia.com](https://build.nvidia.com) if you want hosted Nemotron through NVIDIA NIM.
- Optional: an OpenRouter API key if you want to use OpenRouter-backed coding agents.

## 1. Prepare Jetson Linux

Follow NVIDIA's Jetson Orin Nano Developer Kit quick start first:

<https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/quick_start.html>

After first boot, update packages:

```console
$ sudo apt-get update
$ sudo apt-get upgrade -y
```

If you are using the Orin Nano Super performance mode, enable `MAXN SUPER` from the Ubuntu desktop power menu.

## 2. Install Docker, Node.js, and OpenShell

If you already have the `nemoclawd` CLI installed, use the Orin Nano setup command after JetPack is installed. It configures Docker for OpenShell's k3s-in-Docker gateway, installs the OpenShell CLI if needed, and prints the hosted Nemotron onboarding commands.

```console
$ sudo nemoclawd setup-orin-nano
```

If you are preparing from a source checkout before global CLI install, run the script directly:

```console
$ sudo bash scripts/setup-orin-nano.sh
```

Check Docker first if you want to do the steps manually, because some JetPack images already include it:

```console
$ docker --version
```

If Docker is missing, install it using your JetPack-compatible Docker package source, then allow your user to run Docker:

```console
$ sudo usermod -aG docker "$USER"
$ newgrp docker
$ docker run --rm hello-world
```

Install Node.js 22:

```console
$ curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
$ sudo apt-get install -y nodejs
$ node --version
$ npm --version
```

Install the OpenShell CLI for the Jetson's `aarch64` architecture:

```console
$ ARCH="$(uname -m)"
$ sudo curl -fsSL "https://github.com/NVIDIA/OpenShell/releases/latest/download/openshell-linux-${ARCH}" -o /usr/local/bin/openshell
$ sudo chmod +x /usr/local/bin/openshell
$ openshell --help
```

## 3. Install Nemo Clawd

Install the published CLI:

```console
$ sudo npm install -g @mawdbotsonsolana/nemoclawd
$ nemoclawd doctor
```

Then run the Orin Nano host-prep command if you did not run the script directly in the previous step:

```console
$ sudo nemoclawd setup-orin-nano
```

Or install from a local checkout:

```console
$ git clone https://github.com/x402agent/nemo-clawd.git
$ cd nemo-clawd
$ sudo npm install -g .
$ nemoclawd doctor
```

## 4. Configure Hosted Nemotron

Set your NVIDIA API key:

```console
$ export NVIDIA_API_KEY="nvapi-..."
```

Run onboarding and choose `NVIDIA Cloud API (build.nvidia.com)` when prompted:

```console
$ nemoclawd onboard
```

The published CLI defaults the NVIDIA-hosted route to Nemotron 3 Ultra. If you need to reapply the route after onboarding, run:

```console
$ openshell inference set --no-verify \
    --provider nvidia-nim \
    --model nvidia/nemotron-3-ultra-550b-a55b
```

If you are using the OpenShell plugin CLI directly, you can configure the same route noninteractively:

```console
$ nemoclawd nemoclawd onboard \
    --endpoint build \
    --api-key "$NVIDIA_API_KEY" \
    --model nvidia/nemotron-3-ultra-550b-a55b
```

Hosted endpoint details:

| Provider | Endpoint or model ref |
|---|---|
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` |
| NVIDIA hosted model ID | `nvidia/nemotron-3-ultra-550b-a55b` |
| OpenRouter model ID | `nvidia/nemotron-3-ultra-550b-a55b` |

## 5. Launch and Verify the Sandbox

List the sandbox:

```console
$ openshell sandbox list
```

Connect to it:

```console
$ openshell sandbox connect nemoclawd
```

Run a smoke test inside the sandbox:

```console
$ nemoclawd-start nemoclawd agent --agent main --local \
    -m "Summarize the active inference provider." \
    --session-id orin-smoke-test
```

Monitor egress approvals from another terminal:

```console
$ openshell term
```

## 6. Optional Local Ollama Fallback

Use this only for small local models. It is useful when the Orin Nano needs an offline or low-cost fallback.

Install Ollama:

```console
$ curl -fsSL https://ollama.com/install.sh | sh
```

Run a small model and keep the Ollama server available on the host:

```console
$ ollama run llama3.2:3b
```

Then onboard with local Ollama enabled:

```console
$ export NEMOCLAWD_EXPERIMENTAL=1
$ nemoclawd onboard
```

Choose the Ollama option when prompted. Nemo Clawd registers it as an OpenAI-compatible provider at:

```text
http://host.openshell.internal:11434/v1
```

Jetson AI Lab maintains current Ollama-on-Jetson guidance:

<https://www.jetson-ai-lab.com/tutorials/ollama/>

## 7. Optional Agentic Coding Tools on Orin Nano

For terminal coding agents running on the Orin Nano, keep the model hosted and use the same Nemotron 3 Ultra IDs from the pasted material.

Shared environment:

```console
$ export NVIDIA_API_KEY="nvapi-..."
$ export NVIDIA_BASE_URL="https://integrate.api.nvidia.com/v1"
$ export NVIDIA_MODEL="nvidia/nemotron-3-ultra-550b-a55b"
$ export OPENROUTER_API_KEY="sk-or-..."
```

OpenHands uses LiteLLM-style OpenAI-compatible settings:

```console
$ export LLM_MODEL="openai/nvidia/nemotron-3-ultra-550b-a55b"
$ export LLM_BASE_URL="https://integrate.api.nvidia.com/v1"
$ export LLM_API_KEY="$NVIDIA_API_KEY"
$ export LLM_MAX_INPUT_TOKENS=1000000
$ export LLM_MAX_OUTPUT_TOKENS=32768
$ openhands
```

OpenCode and Kilo can use an OpenAI-compatible provider with:

```json
{
  "provider": {
    "nvidia": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NVIDIA NIM",
      "options": {
        "baseURL": "{env:NVIDIA_BASE_URL}",
        "apiKey": "{env:NVIDIA_API_KEY}"
      }
    }
  },
  "model": "nvidia/nemotron-3-ultra-550b-a55b"
}
```

OpenClaw and other OpenRouter-backed tools should use:

```text
openrouter/nvidia/nemotron-3-ultra-550b-a55b
```

## Do Not Use the Spark Cluster Path

Skip these Spark-only assumptions on Orin Nano:

- Four-node DGX Spark cluster setup.
- `--tensor-parallel-size 4`, `--nnodes 4`, or per-node `NODE_RANK`.
- ConnectX/RoCE interface configuration such as `NCCL_IB_HCA`.
- The community `spark-vllm-docker` recipe.
- `nemoclawd setup-spark`.

Those steps exist for DGX Spark and multi-node vLLM. A single Orin Nano should run Nemo Clawd locally and use hosted Nemotron or a small local model.

## Troubleshooting

| Issue | Fix |
|---|---|
| Docker permission denied | Run `sudo usermod -aG docker "$USER"` and start a new login session or run `newgrp docker`. |
| OpenShell asset not found | Confirm `uname -m` prints `aarch64`, then check the OpenShell release assets. |
| Hosted inference fails | Confirm `NVIDIA_API_KEY` starts with `nvapi-` and rerun `openshell inference set --provider nvidia-nim --model nvidia/nemotron-3-ultra-550b-a55b`. |
| Local Ollama model is too slow or OOMs | Use a smaller quantized model or switch back to hosted Nemotron. |
| Confused by "Nano Omni" | Treat `Nemotron 3 Nano Omni` as a model name. It is not sized for local serving on Jetson Orin Nano. |

## Related Topics

- [Switch Inference Providers](../inference/switch-inference-providers.md)
- [Inference Profiles](../reference/inference-profiles.md)
- [Monitor Sandbox Activity](../monitoring/monitor-sandbox-activity.md)
