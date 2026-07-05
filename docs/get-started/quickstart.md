---
title:
  page: "Nemo Clawd Quickstart - Install, Onboard, and Run Your First Agent"
  nav: "Quickstart"
description: "Install Nemo Clawd, create an OpenShell sandbox, configure inference and Solana, and run the agent."
keywords: ["nemoclawd quickstart", "install nemoclawd", "nemo clawd sandbox", "openshell agent"]
topics: ["generative_ai", "ai_agents"]
tags: ["nemoclawd", "openshell", "sandboxing", "inference_routing", "solana"]
content:
  type: get_started
  difficulty: technical_beginner
  audience: ["developer", "engineer"]
status: published
---

<!--
  SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
  SPDX-License-Identifier: Apache-2.0
-->

# Nemo Clawd Quickstart - Install, Onboard, and Run Your First Agent

Install `nemoclawd`, create a sandboxed Nemo Clawd agent, configure inference, and start the Solana runtime.
The CLI uses OpenShell for sandboxing, policy enforcement, dashboard forwarding, and inference routing.

## Prerequisites

- Node.js 20 or later and npm 10 or later.
- Docker with a running daemon.
- An NVIDIA API key for hosted Nemotron inference, unless you use a local Ollama route.
- Optional Solana, Helius, Privy, Telegram, and Pump-Fun credentials for wallet and messaging features.

:::{note}
On DGX Spark and Jetson Orin Nano hosts, Docker must use `cgroupns=host` for the OpenShell gateway.
If onboarding reports a cgroup error, run `sudo nemoclawd setup-spark` on DGX Spark or `sudo nemoclawd setup-orin-nano` on Jetson Orin Nano, then rerun onboarding.
:::

## Install Nemo Clawd

Use the installer when you want Node.js setup, optional GPU/Ollama checks, the `nemoclawd` CLI, and onboarding in one flow.

```console
$ curl -fsSL https://raw.githubusercontent.com/Solizardking/nemo-clawd/main/install.sh | bash
```

To install only the CLI from npm, run:

```console
$ npm install -g @mawdbotsonsolana/nemoclawd
```

Verify the local command and runtime state:

```console
$ nemoclawd doctor
```

The command prints the Node.js version, installed package version, DFlow routing mode, and an `OK` status when the host checks pass.

## Run Onboarding

Start the onboarding wizard:

```console
$ nemoclawd onboard
```

You can also run the launch alias:

```console
$ nemoclawd launch
```

The wizard performs the following setup:

1. Checks Docker, OpenShell, GPU support, and host cgroup configuration.
2. Starts an OpenShell gateway named `nemoclawd`.
3. Creates an OpenShell sandbox from the bundled Nemo Clawd image and baseline policy.
4. Configures inference through NVIDIA Cloud API by default, or Ollama when selected.
5. Sets the active OpenShell inference route.
6. Starts the Nemo Clawd gateway inside the sandbox.
7. Configures Solana RPC and an optional Privy agentic wallet.
8. Starts an optional local `solana-test-validator`.
9. Applies suggested network policy presets for npm, Python, Solana, Pump-Fun, Privy, Telegram, Slack, or Discord based on your configuration.

During custom setup, choose or enter the following values:

- Sandbox name.
  The default is `my-assistant`.
- Inference provider.
  Hosted NVIDIA Cloud API is the default route.
- NVIDIA API key.
  The hosted route expects a key that starts with `nvapi-`.
- Solana RPC endpoint.
  Use the public default, Helius, a custom endpoint, or a local validator.
- Privy wallet configuration.
  Provide Privy credentials when you want a managed Solana wallet for the agent.
- Pump-Fun token configuration.
  Provide a token mint and developer wallet only when using tokenized-agent workflows.
- Policy presets.
  Accept the suggested presets or enter a custom comma-separated list.

When onboarding completes, the CLI prints output similar to:

```text
────────────────────────────────────────────────────────
Sandbox      my-assistant (Landlock + seccomp + netns)
Model        nvidia/nemotron-3-ultra-550b-a55b (NVIDIA Cloud API)
Solana RPC   https://rpc.solanatracker.io/public
────────────────────────────────────────────────────────
Run:         nemoclawd my-assistant connect
Solana Up:   nemoclawd solana start my-assistant
Status:      nemoclawd my-assistant status
Logs:        nemoclawd my-assistant logs --follow
Solana:      nemoclawd my-assistant solana-agent
────────────────────────────────────────────────────────
```

:::{note}
If `nemoclawd` is not found after installation, open a new terminal or reload your shell profile.
For most shells, `source ~/.bashrc`, `source ~/.zshrc`, or a new terminal window refreshes the npm global binary path.
:::

## Open the Dashboard

Onboarding starts the sandbox gateway and forwards the dashboard to `127.0.0.1:18789` when the port is available.
The sandbox startup output includes URLs in this format:

```text
[gateway] Local UI: http://127.0.0.1:18789/#token=<token>
[gateway] Remote UI: http://127.0.0.1:18789/#token=<token>
```

Open the local URL in a browser on the machine that runs Nemo Clawd.

For a remote host, create an SSH tunnel from your workstation:

```console
$ ssh -L 18789:127.0.0.1:18789 <user>@<remote-host>
```

Then open the local dashboard URL in your workstation browser:

```text
http://127.0.0.1:18789/#token=<token>
```

:::{note}
Use `127.0.0.1` in the browser URL.
The dashboard origin is configured for that host during onboarding.
:::

If the local forward is not running, start it again:

```console
$ openshell forward start --background 18789 my-assistant
```

## Use the Agent from the Terminal

Open a shell inside the sandbox:

```console
$ nemoclawd my-assistant connect
```

Run an inference smoke test from inside the sandbox:

```console
$ nemoclawd agent --agent main --local -m "Test inference" --session-id quickstart
```

Exit the sandbox shell:

```console
$ exit
```

Start the Solana operator stack from the host:

```console
$ nemoclawd solana start my-assistant
```

This starts the bundled Solana services inside the sandbox, including the Pump-Fun Telegram bot, Solana bridge, websocket relay, and optional payment or swarm services when configured.
Runtime records are written to the Nemo Clawd vault under `~/.nemoclawd/vault/`.

Check sandbox status and logs:

```console
$ nemoclawd my-assistant status
$ nemoclawd my-assistant logs --follow
```

Monitor policy approvals and blocked egress requests in the OpenShell terminal UI:

```console
$ openshell term
```

## Add or Change Network Policy

List available policy presets:

```console
$ nemoclawd policies list
```

Apply a preset to the running sandbox:

```console
$ nemoclawd policies apply my-assistant telegram
$ nemoclawd policies apply my-assistant solana-rpc
$ nemoclawd policies apply my-assistant pumpfun
$ nemoclawd policies apply my-assistant privy
```

Use `openshell term` when the agent attempts to reach a host that is not in the active policy.
Approving a request in the TUI allows it for the current sandbox session.
Apply a preset or update the baseline policy when the endpoint should be allowed on future runs.

## Set Up Telegram Messaging

Create a bot in Telegram by opening [@BotFather](https://t.me/BotFather), sending `/newbot`, and copying the token.
Export the token on the host:

```console
$ export TELEGRAM_BOT_TOKEN=<your-bot-token>
```

Apply the Telegram policy preset when it was not applied during onboarding:

```console
$ nemoclawd policies apply my-assistant telegram
```

Start the sandbox Telegram bot runtime:

```console
$ nemoclawd my-assistant telegram-bot
```

To start the broader Solana stack, including Telegram-aware services when the required environment is present, run:

```console
$ nemoclawd solana start my-assistant
```

Open Telegram, find your bot, and send a message.
If it does not respond, inspect the sandbox status and logs:

```console
$ nemoclawd my-assistant status
$ nemoclawd my-assistant logs --follow
```

:::{note}
Telegram uses outbound Bot API calls.
It does not require `cloudflared` or a public webhook URL for the sandbox bot runtime.
Use `cloudflared` only when you want a public URL for the dashboard or auxiliary web services.
:::

## Optional Public Dashboard Tunnel

Install `cloudflared` when you want a public dashboard URL for a remote or headless host.
On Linux arm64 hosts, use the arm64 package:

```console
$ curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
$ sudo dpkg -i cloudflared.deb
```

Start the tunnel to the local dashboard port:

```console
$ cloudflared tunnel --url http://localhost:18789
```

The tunnel prints a `trycloudflare.com` URL.
Keep the local dashboard token in the URL fragment when opening the public tunnel.

## Next Steps

- [Switch inference providers](../inference/switch-inference-providers.md) to use a different model or endpoint.
- [Set up Jetson Orin Nano](../deployment/set-up-orin-nano.md) when running Nemo Clawd on Orin Nano hardware.
- [Approve or deny network requests](../network-policy/approve-network-requests.md) when the agent tries to reach external hosts.
- [Customize the network policy](../network-policy/customize-network-policy.md) to pre-approve trusted domains.
- [Deploy to a remote GPU instance](../deployment/deploy-to-remote-gpu.md) for always-on operation.
- [Monitor sandbox activity](../monitoring/monitor-sandbox-activity.md) through the OpenShell TUI.
