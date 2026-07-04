---
title:
  page: "ZK Primitives — Nullifiers, Attestations, and Encrypted State"
  nav: "ZK Primitives"
description: "Use the bundled Clawd ZK primitives workspace for nullifiers, Groth16 proof preparation, and Light Protocol compressed-state helpers."
keywords: ["clawd zk primitives", "solana nullifiers", "groth16", "light protocol", "compressed state"]
topics: ["blockchain", "ai_agents"]
tags: ["zk", "solana", "light_protocol", "attestation", "nullifier"]
content:
  type: reference
  difficulty: intermediate
  audience: ["developer", "engineer"]
status: published
---

# ZK Primitives

Nemo Clawd includes `zk-primitives/`, a source workspace for Solana-native proof and provenance primitives.
The workspace is intentionally separate from the default CLI build so operators can inspect, build, and test it without silently enabling transaction submission.

## What Is Included

| Path | Purpose |
|---|---|
| `zk-primitives/client/` | TypeScript SDK for nullifier derivation, Groth16 proof packing, Light Protocol helpers, and instruction construction. |
| `zk-primitives/agent/` | Deterministic intent router and CLI wrapper around the client. |
| `zk-primitives/programs/clawd-zk/` | Anchor-style on-chain program scaffold for attestations, one-shot consumption, and encrypted-state commitments. |
| `zk-primitives/configs/` | Light tree and runtime configuration examples. |
| `zk-primitives/docs/` | Architecture, integration, and lineage notes. |
| `zk-primitives/tests/` | Cross-package TypeScript and Rust test references. |

## Root Commands

Run ZK checks from the repository root:

```bash
pnpm --dir zk-primitives install --frozen-lockfile
npm run build:zk
npm run lint:zk
npm run test:zk
```

`npm run check:zk` runs build, lint, and tests in sequence.

## Trust Boundary

The TypeScript agent can inspect config, verify proof shape, compute nullifiers, and build instructions locally.
Signing and sending transactions remains a delegated operator action.
Set `ZK_SHARK_RPC_URL` or legacy `CLAWD_ZK_RPC_URL` only when you need live RPC-backed instruction construction.

## Related References

- `zk-primitives/README.md`
- `zk-primitives/docs/ARCHITECTURE.md`
- `zk-primitives/docs/INTEGRATION.md`
- `zk-primitives/zk.md`
