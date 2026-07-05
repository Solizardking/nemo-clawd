# Nemo Clawd Blueprint (Python)

Blueprint runner and migration tooling for **Nemo Clawd** — orchestrates sandbox
creation, host-to-sandbox migration, and NIM/vLLM inference routing inside
[OpenShell](https://github.com/NVIDIA/OpenShell).

The runner is a Python CLI called by the thin TypeScript plugin via subprocess.
It communicates over a simple stdout protocol:

- `PROGRESS:<0-100>:<label>` — progress updates
- `RUN_ID:<id>` — the run identifier for the invocation
- exit code `0` = success, non-zero = failure

## Requirements

- Python **3.11+**
- [`uv`](https://docs.astral.sh/uv/) (project is uv-managed)
- `openshell` CLI on `PATH`
- `pyyaml` (only runtime dependency)

## Layout

```
nemo-clawd-python/
├── blueprint.yaml               # Blueprint definition: sandbox, inference profiles, trading, policy additions
├── orchestrator/
│   └── runner.py                # CLI entry point: plan / apply / status / rollback
├── migrations/
│   └── snapshot.py              # Snapshot, restore, cutover, rollback of ~/.nemoclawd
├── policies/
│   ├── nemoclawd-sandbox.yaml   # Strict deny-by-default baseline policy for the sandbox
│   └── presets/                 # Opt-in network policy presets (docker, discord, jira,
│                                #   huggingface, npm, pypi, outlook, privy, pumpfun,
│                                #   slack, solana-rpc, telegram)
├── Makefile                     # lint / format / check via ruff
└── pyproject.toml
```

## Usage

The runner reads `blueprint.yaml` from `NEMOCLAWD_BLUEPRINT_PATH` (default: current directory).

```bash
# Plan a deployment: validate the blueprint, resolve the profile, check prerequisites
python orchestrator/runner.py plan --profile vllm

# Apply: create the sandbox, configure the inference provider, set the route
python orchestrator/runner.py apply --profile ncp --endpoint-url https://my-ncp-endpoint/v1

# Show the most recent run (or a specific one with --run-id)
python orchestrator/runner.py status

# Roll back a run: stop and remove the sandbox, mark state as rolled back
python orchestrator/runner.py rollback --run-id nc-20260705-120000-abcd1234
```

Run state is persisted under `~/.nemoclawd/state/runs/<run-id>/plan.json`.

### Inference profiles

Profiles are defined in `blueprint.yaml` under `components.inference.profiles`:

| Profile     | Provider  | Model                              | Credential env    |
|-------------|-----------|------------------------------------|-------------------|
| `default` / `zai` | Z.ai GLM | `zai/glm-5.2`                | `ZAI_API_KEY`     |
| `ncp`       | NVIDIA NCP (dynamic endpoint) | `nvidia/nemotron-3-super-120b-a12b` | `NVIDIA_API_KEY` |
| `nim-local` | Local NIM service | `nvidia/nemotron-3-super-120b-a12b` | `NIM_API_KEY` |
| `vllm`      | Local vLLM (`localhost:8000`) | `nvidia/nemotron-3-nano-30b-a3b` | `OPENAI_API_KEY` |
| `dflow`     | DFlow trading (spot + prediction markets) | — | `DFLOW_API_KEY` |

Use `--endpoint-url` to override a profile's endpoint at plan/apply time
(e.g. the dynamically provisioned NCP endpoint).

## Migration (`migrations/snapshot.py`)

Library functions for moving a host Nemo Clawd install into the OpenShell sandbox:

- `create_snapshot()` — copies `~/.nemoclawd` (config, workspace, extensions,
  skills) into a timestamped snapshot with a JSON manifest
- `restore_into_sandbox(snapshot_dir, sandbox_name)` — pushes snapshot contents
  into the running sandbox via `openshell sandbox cp`
- `cutover_host(snapshot_dir)` — archives the host `~/.nemoclawd` after migration
- `rollback_from_snapshot(snapshot_dir)` — restores the host config from a snapshot
- `list_snapshots()` — enumerates available snapshots (newest first)

Snapshots live under `~/.nemoclawd/snapshots/<timestamp>/`.

## Policies

`policies/nemoclawd-sandbox.yaml` is the strict baseline: deny by default,
allowing only what core operation needs — Anthropic API (Claude Code), NVIDIA
inference endpoints, DFlow trading APIs, GitHub, npm registry, ClawdHub /
nemo-clawd.ai, Telegram Bot API, and host Ollama on port 11434. Most rules are
binary-restricted (e.g. only `nemoclawd` or `curl` may reach an endpoint).

`policies/presets/` contains opt-in network policy presets for common
integrations (Slack, Discord, Jira, Hugging Face, Solana RPC, Docker Hub, etc.).
Apply them post-creation via `openshell policy set`, or add them to the base
policy and re-run the migration.

## Development

```bash
make lint     # ruff check
make format   # ruff format + autofix
make check    # lint + format check (CI gate)
```

## License

Apache-2.0. Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES.
