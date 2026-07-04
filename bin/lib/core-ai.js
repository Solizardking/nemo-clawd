// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const fs = require("fs");
const path = require("path");
const { ROOT } = require("./runner");

const CORE_AI_ROOT = path.join(ROOT, "core-ai");

const PACKAGES = [
  {
    id: "helius-mcp",
    name: "Helius MCP",
    relativePath: "helius-mcp",
    description: "MCP server for Helius and Solana data tools.",
    commands: {
      install: "pnpm --dir core-ai/helius-mcp install --frozen-lockfile",
      build: "npm run core-ai:helius-mcp:build",
      test: "npm run core-ai:helius-mcp:test",
      run: "node core-ai/helius-mcp/dist/index.js",
    },
  },
  {
    id: "helius-cli",
    name: "Helius CLI",
    relativePath: "helius-cli",
    description: "CLI for Helius account, wallet, RPC, DAS, and staking workflows.",
    commands: {
      install: "pnpm --dir core-ai/helius-cli install --frozen-lockfile",
      build: "npm run core-ai:helius-cli:build",
      test: "npm run core-ai:helius-cli:test",
      run: "pnpm --dir core-ai/helius-cli dev --help",
    },
  },
  {
    id: "helius-skills",
    name: "Helius Skills",
    relativePath: "helius-skills",
    description: "Canonical Clawd skill sources for Helius, DFlow, Jupiter, Phantom, OKX, and SVM.",
    commands: {
      compile: "npm run core-ai:compile-skills",
    },
  },
  {
    id: "helius-plugin",
    name: "Helius Plugin",
    relativePath: "helius-plugin",
    description: "Clawd plugin bundling Helius skills and MCP startup config.",
    commands: {
      run: "clawd --plugin-dir core-ai/helius-plugin",
    },
  },
  {
    id: "helius-cursor",
    name: "Helius Cursor",
    relativePath: "helius-cursor",
    description: "Cursor-compatible rules, agent prompt, and Helius skill bundle.",
  },
  {
    id: "clawd-code",
    name: "Clawd Code",
    relativePath: "clawd-code",
    description: "Solana-native AI coding CLI with multi-provider routing and paper-gated perps modes.",
    commands: {
      install: "npm ci --prefix core-ai/clawd-code",
      build: "npm run core-ai:clawd-code:build",
      test: "npm --prefix core-ai/clawd-code test",
      run: "npm --prefix core-ai/clawd-code run dev -- code",
    },
  },
  {
    id: "clawd-grok",
    name: "Clawd Grok",
    relativePath: "clawd-grok",
    description: "Bun-native Grok agent runtime for REPL, audio, LSP, MCP, payments, and wallet workflows.",
    commands: {
      install: "bun install --cwd core-ai/clawd-grok",
      build: "npm run core-ai:clawd-grok:build",
      run: "bun run --cwd core-ai/clawd-grok dev",
    },
  },
  {
    id: "clawd-perps-agent",
    name: "Clawd Perps Agent",
    relativePath: "clawd-perps-agent",
    description: "Phoenix/Vulcan/Imperial perpetuals agent surface with PAPER defaults.",
    commands: {
      install: "npm ci --prefix core-ai/clawd-perps-agent",
      build: "npm run core-ai:perps:build",
      typecheck: "npm --prefix core-ai/clawd-perps-agent run typecheck",
    },
  },
  {
    id: "mcp-server",
    name: "Pump MCP Server",
    relativePath: "mcp-server",
    description: "Standalone MCP server for pump-sdk and related tooling.",
    commands: {
      install: "npm ci --prefix core-ai/mcp-server",
      build: "npm run core-ai:mcp-server:build",
      run: "npm --prefix core-ai/mcp-server start",
    },
  },
  {
    id: "v3",
    name: "Open Clawd v3",
    relativePath: "v3",
    description: "Next-generation Clawd runtime scaffold.",
    commands: {
      install: "npm install --prefix core-ai/v3",
      run: "npm run core-ai:v3:start",
    },
  },
  {
    id: "knowledge",
    name: "Knowledge Base",
    relativePath: "knowledge",
    description: "Facts, gotchas, patterns, decisions, and Clawd architecture notes.",
  },
  {
    id: "docs",
    name: "Architecture Docs",
    relativePath: "docs",
    description: "Architecture decision records for the open Clawd stack.",
  },
];

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function loadVersions() {
  return readJson(path.join(CORE_AI_ROOT, "versions.json"), {}) || {};
}

function loadPackageJson(relativePath) {
  return readJson(path.join(CORE_AI_ROOT, relativePath, "package.json"), null);
}

function packageInfo(def, versions = loadVersions()) {
  const fullPath = path.join(CORE_AI_ROOT, def.relativePath);
  const packageJson = loadPackageJson(def.relativePath);
  return {
    id: def.id,
    name: def.name,
    path: path.relative(ROOT, fullPath),
    exists: fs.existsSync(fullPath),
    version: packageJson?.version || versions[def.id] || null,
    description: def.description,
    scripts: packageJson?.scripts ? Object.keys(packageJson.scripts).sort() : [],
    commands: def.commands || {},
  };
}

function getCoreAiStatus() {
  const versions = loadVersions();
  const packages = PACKAGES.map((def) => packageInfo(def, versions));
  return {
    root: path.relative(ROOT, CORE_AI_ROOT),
    exists: fs.existsSync(CORE_AI_ROOT),
    packageCount: packages.length,
    presentCount: packages.filter((pkg) => pkg.exists).length,
    versions,
    packages,
  };
}

function printHelp() {
  console.log(`Usage: nemoclawd core-ai <command>

Commands:
  status                       Show bundled Core AI status
  packages                     List imported Core AI packages
  package <id>                 Show one package and its commands
  commands                     Print common setup/build/run commands

Options:
  --json                       Print machine-readable output`);
}

function printStatus(jsonOutput = false) {
  const status = getCoreAiStatus();
  if (jsonOutput) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log("Core AI bundle");
  console.log(`  Path:     ${status.root}`);
  console.log(`  Present:  ${status.exists ? "yes" : "no"}`);
  console.log(`  Packages: ${status.presentCount}/${status.packageCount}`);
  const versionPairs = Object.entries(status.versions).map(([name, version]) => `${name}@${version}`);
  if (versionPairs.length) {
    console.log(`  Versions: ${versionPairs.join(", ")}`);
  }
  console.log("  Next:     nemoclawd core-ai packages");
}

function printPackages(jsonOutput = false) {
  const packages = getCoreAiStatus().packages;
  if (jsonOutput) {
    console.log(JSON.stringify(packages, null, 2));
    return;
  }

  console.log("Core AI packages:");
  for (const pkg of packages) {
    const version = pkg.version ? `@${pkg.version}` : "";
    const marker = pkg.exists ? "ok" : "missing";
    console.log(`  ${pkg.id}${version} [${marker}] - ${pkg.description}`);
  }
}

function printPackage(id, jsonOutput = false) {
  const status = getCoreAiStatus();
  const pkg = status.packages.find((candidate) => candidate.id === id);
  if (!pkg) {
    throw new Error(`Unknown Core AI package: ${id}`);
  }
  if (jsonOutput) {
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  console.log(`${pkg.name}${pkg.version ? ` ${pkg.version}` : ""}`);
  console.log(`  ID:      ${pkg.id}`);
  console.log(`  Path:    ${pkg.path}`);
  console.log(`  Present: ${pkg.exists ? "yes" : "no"}`);
  if (pkg.scripts.length) {
    console.log(`  Scripts: ${pkg.scripts.join(", ")}`);
  }
  const commands = Object.entries(pkg.commands);
  if (commands.length) {
    console.log("  Commands:");
    for (const [name, command] of commands) {
      console.log(`    ${name}: ${command}`);
    }
  }
}

function printCommands(jsonOutput = false) {
  const commandRows = getCoreAiStatus().packages.flatMap((pkg) =>
    Object.entries(pkg.commands).map(([name, command]) => ({
      package: pkg.id,
      name,
      command,
    })),
  );

  if (jsonOutput) {
    console.log(JSON.stringify(commandRows, null, 2));
    return;
  }

  console.log("Core AI commands:");
  for (const row of commandRows) {
    console.log(`  ${row.package}:${row.name}  ${row.command}`);
  }
}

function coreAiCommand(args) {
  const jsonOutput = args.includes("--json");
  const positionals = args.filter((arg) => arg !== "--json");
  const cmd = positionals[0] || "status";

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  if (cmd === "status") {
    printStatus(jsonOutput);
    return;
  }
  if (cmd === "packages" || cmd === "list") {
    printPackages(jsonOutput);
    return;
  }
  if (cmd === "package" || cmd === "show") {
    const id = positionals[1];
    if (!id) throw new Error("Usage: nemoclawd core-ai package <id>");
    printPackage(id, jsonOutput);
    return;
  }
  if (cmd === "commands") {
    printCommands(jsonOutput);
    return;
  }

  throw new Error(`Unknown core-ai command: ${cmd}`);
}

module.exports = {
  CORE_AI_ROOT,
  PACKAGES,
  coreAiCommand,
  getCoreAiStatus,
};
