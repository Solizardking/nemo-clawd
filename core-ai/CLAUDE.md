# Core AI — Clawd Compatibility Instructions

This file is kept only for runtimes that still auto-load `CLAWD.md`.
The effective agent harness is Clawd-native; prefer [`AGENTS.md`](./AGENTS.md) and Clawd Code.

When this file is loaded:

- Treat this repository as Clawd Core AI, not a legacy assistant plugin.
- Use `clawd --plugin-dir ./helius-plugin` for the plugin workflow.
- Configure MCP servers in `.clawd/settings.json`.
- Read domain skills from `.agents/skills/` or canonical sources in `helius-skills/`.
- Use `clawd-code` for code, trade, research, image, and voice workflows.
