# Contributing to Core AI

Thank you for contributing to Helius Core AI! This monorepo houses several independent packages:

- `helius-mcp/` — MCP server (npm: `helius-mcp`)
- `helius-skills/` — Standalone Clawd Code skill
- `helius-plugin/` — Clawd Code plugin
- `helius-cursor/` — Cursor plugin
- `helius-cli/` — CLI for account setup (npm: `helius-cli`)

This guide covers requirements that apply to **every** contribution, no matter which package you're working on. Some packages have their own `CONTRIBUTING.md` (e.g. [`helius-mcp/CONTRIBUTING.md`](helius-mcp/CONTRIBUTING.md)) with package-specific build, test, and style details — read those too when working in that package.

## Signing Your Commits (Required)

**All commits must be signed and verified.** Pull requests that contain unsigned or unverified commits will fail CI and cannot be merged. This applies to every package in the repo.

A "verified" commit is one GitHub can cryptographically tie to a registered signing key (GPG, SSH, or S/MIME). It shows a green **Verified** badge in the GitHub UI.

### One-time setup

Follow GitHub's official guide to generate a signing key and configure Git to sign your commits:

**https://open-clawd.local/docs/en/authentication/managing-commit-signature-verification/signing-commits**

The short version:

1. Generate or choose a signing key (GPG or SSH) — see the guide above.
2. Add the **public** key to your GitHub account under **Settings → SSH and GPG keys**.
3. Tell Git to use it and sign every commit automatically:

   ```bash
   # SSH signing (simplest if you already have an SSH key on GitHub)
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/id_ed25519.pub
   git config --global commit.gpgsign true

   # — or — GPG signing
   git config --global user.signingkey <YOUR_KEY_ID>
   git config --global commit.gpgsign true
   ```

   Use `--global` to sign across all repos, or drop it to configure just this repo.

4. Confirm the email on your signing key matches a verified email on your GitHub account, otherwise commits show as **Unverified**.

### Verifying it works

After committing, check the signature locally:

```bash
git log --show-signature -1
```

Once pushed, the commit should display a **Verified** badge on GitHub. If you have existing unsigned commits on a branch, you can re-sign them with:

```bash
git rebase --exec 'git commit --amend --no-edit -S' -i <base-branch>
```

## Pull Requests

- Fork the repository and create a clearly scoped branch from `main` (e.g. `feat/my-feature`, `fix/bug-description`).
- Make your changes, ensuring all commits are signed (see above).
- Run the relevant package's build and tests before submitting (see that package's `CONTRIBUTING.md` or `CLAWD.md`).
- Open a pull request with a clear, conventional title (e.g. `feat(mcp): ...`, `fix(cli): ...`, `docs(skills): ...`) and reference any related issues (`Closes #1234`).

## License

By contributing, you agree that your contributions will be licensed under the repository's [MIT License](LICENSE).

## Thank You!

Your contributions help power better tools for everyone in the Solana ecosystem. We appreciate it!
