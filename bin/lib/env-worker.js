// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ENV_DIR = path.join(os.homedir(), ".nemoclawd");
const DEFAULT_ENV_FILE = path.join(ENV_DIR, ".env");
const DEFAULT_STATE_FILE = path.join(ENV_DIR, "env-worker.json");
const KNOWN_KEYS = [
  "HELIUS_RPC_URL",
  "HELIUS_API_KEY",
  "SOLANA_RPC_URL",
  "RPC_URL",
  "RPC",
  "GATEKEEPER_RPC_URL",
  "HELIUS_WSS_URL",
  "HELIUS_ATLAS_WSS_URL",
  "CLAWDROUTER_SOLANA_RPC_URL",
  "NOVITA_API_KEY",
];
const SECRET_PATTERNS = /(api[_-]?key|token|secret|password|authorization|credential|rpc|wss|novita)/i;

function getEnvFilePath(opts = {}) {
  if (opts.envFile) return path.resolve(expandHome(opts.envFile));
  if (process.env.NEMOCLAWD_ENV_FILE) return path.resolve(expandHome(process.env.NEMOCLAWD_ENV_FILE));
  return DEFAULT_ENV_FILE;
}

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function stripQuotes(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eq = normalized.indexOf("=");
    if (eq <= 0) continue;
    const key = normalized.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env[key] = stripQuotes(normalized.slice(eq + 1));
  }
  return env;
}

function readEnvFile(envFile = getEnvFilePath()) {
  if (!fs.existsSync(envFile)) {
    return { envFile, exists: false, values: {} };
  }
  return {
    envFile,
    exists: true,
    values: parseEnv(fs.readFileSync(envFile, "utf-8")),
  };
}

function extractHeliusApiKey(rpcUrl) {
  try {
    const parsed = new URL(rpcUrl || "");
    return parsed.searchParams.get("api-key") || parsed.searchParams.get("apiKey");
  } catch {
    return "";
  }
}

function withHeliusAliases(values) {
  const next = { ...values };
  const rpcUrl = next.HELIUS_RPC_URL || next.SOLANA_RPC_URL || next.RPC_URL || next.RPC || next.CLAWDROUTER_SOLANA_RPC_URL;
  const heliusKey = next.HELIUS_API_KEY || extractHeliusApiKey(rpcUrl);

  if (rpcUrl) {
    for (const key of ["HELIUS_RPC_URL", "SOLANA_RPC_URL", "RPC_URL", "RPC", "GATEKEEPER_RPC_URL", "CLAWDROUTER_SOLANA_RPC_URL"]) {
      if (!next[key]) next[key] = rpcUrl;
    }
  }

  if (heliusKey && !next.HELIUS_API_KEY) {
    next.HELIUS_API_KEY = heliusKey;
  }

  if (heliusKey) {
    if (!next.HELIUS_WSS_URL) next.HELIUS_WSS_URL = `wss://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    if (!next.HELIUS_ATLAS_WSS_URL) next.HELIUS_ATLAS_WSS_URL = `wss://atlas-mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  }

  return next;
}

function loadEnvWorker(opts = {}) {
  const envFile = getEnvFilePath(opts);
  const loaded = readEnvFile(envFile);
  const values = withHeliusAliases(loaded.values);
  const applied = [];

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    if (opts.override || !process.env[key]) {
      process.env[key] = String(value);
      applied.push(key);
    }
  }

  return {
    envFile,
    exists: loaded.exists,
    keys: Object.keys(values).sort(),
    applied: applied.sort(),
  };
}

function maskValue(value) {
  if (!value) return "";
  const text = String(value);

  try {
    const parsed = new URL(text);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SECRET_PATTERNS.test(key)) {
        parsed.searchParams.set(key, "****");
      }
    }
    return parsed.toString();
  } catch {}

  if (text.length <= 8) return "****";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function statusSnapshot(envFile = getEnvFilePath()) {
  const loaded = readEnvFile(envFile);
  const fileValues = withHeliusAliases(loaded.values);
  const keys = Array.from(new Set([...KNOWN_KEYS, ...Object.keys(fileValues)])).sort();

  return {
    envFile,
    exists: loaded.exists,
    keys: keys.map((key) => {
      const value = process.env[key] || fileValues[key] || "";
      return {
        key,
        present: Boolean(value),
        source: process.env[key] ? "process" : fileValues[key] ? "file" : "missing",
        value: value ? maskValue(value) : "",
      };
    }),
  };
}

function writeState(state) {
  fs.mkdirSync(ENV_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(DEFAULT_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function readState() {
  try {
    if (fs.existsSync(DEFAULT_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(DEFAULT_STATE_FILE, "utf-8"));
    }
  } catch {}
  return null;
}

function startWorker(opts = {}) {
  const envFile = getEnvFilePath(opts);
  const logFile = path.join(ENV_DIR, "env-worker.log");
  fs.mkdirSync(ENV_DIR, { recursive: true, mode: 0o700 });

  const child = spawn(process.execPath, [__filename, "--serve", envFile], {
    detached: true,
    stdio: ["ignore", fs.openSync(logFile, "a"), fs.openSync(logFile, "a")],
    env: { ...process.env, NEMOCLAWD_ENV_FILE: envFile },
  });
  child.unref();

  const state = {
    pid: child.pid,
    envFile,
    logFile,
    startedAt: new Date().toISOString(),
  };
  writeState(state);
  return state;
}

function serve(envFile) {
  loadEnvWorker({ envFile, override: true });
  const snapshot = statusSnapshot(envFile);
  writeState({
    pid: process.pid,
    envFile,
    logFile: path.join(ENV_DIR, "env-worker.log"),
    startedAt: new Date().toISOString(),
    loadedKeys: snapshot.keys.filter((entry) => entry.present).length,
  });

  setInterval(() => {
    loadEnvWorker({ envFile, override: true });
  }, 30000).unref();

  setInterval(() => {}, 1 << 30);
}

function parseArgs(args) {
  const opts = {};
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--file") {
      opts.envFile = args[index + 1];
      index += 1;
    } else if (arg.startsWith("--file=")) {
      opts.envFile = arg.slice("--file=".length);
    } else {
      positionals.push(arg);
    }
  }
  return { opts, positionals };
}

function printStatus(snapshot) {
  console.log(`Env file: ${snapshot.envFile}${snapshot.exists ? "" : " (missing)"}`);
  for (const entry of snapshot.keys) {
    if (!entry.present) continue;
    console.log(`  ${entry.key}: ${entry.value} (${entry.source})`);
  }
}

function envWorkerCommand(args) {
  const { opts, positionals } = parseArgs(args);
  const cmd = positionals[0] || "status";
  const envFile = getEnvFilePath(opts);

  if (cmd === "status" || cmd === "doctor") {
    const snapshot = statusSnapshot(envFile);
    if (opts.json) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }
    printStatus(snapshot);
    const state = readState();
    if (state) {
      console.log(`Worker: pid=${state.pid} env=${state.envFile}`);
    }
    return;
  }

  if (cmd === "load") {
    const result = loadEnvWorker({ envFile, override: true });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Loaded ${result.applied.length} env keys from ${result.envFile}`);
    return;
  }

  if (cmd === "start") {
    const result = startWorker({ envFile });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Env worker started: pid=${result.pid}`);
    console.log(`Env file: ${result.envFile}`);
    console.log(`Log file: ${result.logFile}`);
    return;
  }

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(`Usage: nemoclawd env <command>

Commands:
  status             Show masked env worker status
  load               Load env file into this process
  start              Start a small local env worker daemon

Options:
  --file <path>      Use a specific env file
  --json             Print JSON output`);
    return;
  }

  throw new Error(`Unknown env command: ${cmd}`);
}

if (require.main === module && process.argv[2] === "--serve") {
  serve(process.argv[3] || getEnvFilePath());
}

module.exports = {
  DEFAULT_ENV_FILE,
  envWorkerCommand,
  loadEnvWorker,
  maskValue,
  statusSnapshot,
  withHeliusAliases,
};
