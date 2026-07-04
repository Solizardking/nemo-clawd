// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const SPINNERS_DIR = path.join(ROOT, "spinners");
const RESERVED_PACK_FILES = new Set(["metadata.json"]);

const PACK_DESCRIPTIONS = {
  "90s-kid": "90s nostalgia",
  "blue-collar-dev": "Trades and construction humor",
  "bob-ross": "Happy little accidents",
  borat: "Borat Sagdiyev",
  cat: "Cat-themed",
  chaos: "Absurdist and chaotic humor",
  coffee: "Coffee and food themed",
  corporate: "Corporate buzzwords and jargon",
  cowboy: "Wild West and frontier",
  "darth-vader": "Star Wars Sith Lord",
  detective: "Noir detective style",
  developer: "Programming and dev culture",
  gardening: "Gardening and growing",
  "gordon-ramsay": "Angry chef yelling at code",
  "gym-bro": "Gym and fitness culture",
  "honest-no-filter": "Brutally honest dev thoughts",
  "jack-sparrow": "Chaotic pirate captain",
  meme: "Internet memes and viral phrases",
  "michael-scott": "The Office Michael Scott",
  minions: "Minion-style humor",
  motivational: "Hype and motivational phrases",
  ninja: "Ninja and stealth",
  ocean: "Ocean and underwater",
  panicker: "Pure dev anxiety",
  philosophical: "Deep thoughts and philosophy",
  pirate: "Pirate speak",
  "retro-gaming": "Retro gaming references",
  "sarcastic-ai": "Self-aware AI humor",
  "sf-entrepreneur": "San Francisco tech scene",
  shakespeare: "Shakespearean and old English",
  "sherlock-holmes": "Deductive reasoning",
  space: "Space and sci-fi",
  startup: "Startup culture",
  superhero: "Superhero themed",
  "the-dude": "Big Lebowski style",
  therapist: "Therapy speak and self-care",
  "time-traveler": "Time travel and paradoxes",
  vibecoder: "Vibe coding culture",
  vim: "Vim editor enthusiasts",
  "walter-white": "Breaking Bad Heisenberg",
  wholesome: "Wholesome and cozy vibes",
  wizard: "Fantasy and magic themed",
  yoda: "Star Wars Jedi Master",
  zombie: "Zombie apocalypse survival",
};

function listSpinnerPacks() {
  return fs
    .readdirSync(SPINNERS_DIR)
    .filter((file) => file.endsWith(".json") && !RESERVED_PACK_FILES.has(file))
    .map((file) => path.basename(file, ".json"))
    .sort();
}

function assertPackName(packName) {
  if (!packName || !/^[a-z0-9][a-z0-9-]*$/.test(packName)) {
    throw new Error("Spinner pack names may only contain lowercase letters, numbers, and hyphens.");
  }
}

function readSpinnerPack(packName) {
  assertPackName(packName);
  const packPath = path.join(SPINNERS_DIR, `${packName}.json`);
  if (!fs.existsSync(packPath)) {
    throw new Error(`Unknown spinner pack: ${packName}`);
  }

  const pack = JSON.parse(fs.readFileSync(packPath, "utf-8"));
  if (!pack || typeof pack !== "object" || !pack.spinnerVerbs || !Array.isArray(pack.spinnerVerbs.verbs)) {
    throw new Error(`Invalid spinner pack: ${packName}`);
  }

  return pack;
}

function expandUserPath(filePath, home = process.env.HOME || "/tmp") {
  if (filePath === "~") return home;
  if (filePath.startsWith("~/")) return path.join(home, filePath.slice(2));
  return filePath;
}

function resolveSettingsPath(opts = {}) {
  const home = opts.home || process.env.HOME || "/tmp";
  if (opts.settingsPath) {
    return path.resolve(expandUserPath(opts.settingsPath, home));
  }

  const clawdPath = path.join(home, ".clawd", "settings.json");
  if (fs.existsSync(clawdPath)) return clawdPath;

  const claudePath = path.join(home, ".claude", "settings.json");
  if (fs.existsSync(claudePath)) return claudePath;

  return clawdPath;
}

function readSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};

  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error(`Settings file must contain a JSON object: ${settingsPath}`);
  }

  return settings;
}

function writeSettings(settingsPath, settings) {
  const existed = fs.existsSync(settingsPath);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  if (!existed) {
    fs.chmodSync(settingsPath, 0o600);
  }
}

function installSpinnerPack(packName, opts = {}) {
  const pack = readSpinnerPack(packName);
  const settingsPath = resolveSettingsPath(opts);
  const settings = readSettings(settingsPath);
  settings.spinnerVerbs = pack.spinnerVerbs;
  writeSettings(settingsPath, settings);

  return {
    packName,
    settingsPath,
    verbCount: pack.spinnerVerbs.verbs.length,
  };
}

function removeSpinnerPack(opts = {}) {
  const settingsPath = resolveSettingsPath(opts);
  const settings = readSettings(settingsPath);
  const hadSpinnerVerbs = Object.prototype.hasOwnProperty.call(settings, "spinnerVerbs");
  delete settings.spinnerVerbs;
  writeSettings(settingsPath, settings);

  return {
    settingsPath,
    removed: hadSpinnerVerbs,
  };
}

function parseSpinnerArgs(args) {
  const opts = {};
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      opts.json = true;
      continue;
    }
    if (arg === "--settings") {
      const value = args[index + 1];
      if (!value) throw new Error("Missing value for --settings");
      opts.settingsPath = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--settings=")) {
      opts.settingsPath = arg.slice("--settings=".length);
      continue;
    }
    positionals.push(arg);
  }

  return { opts, positionals };
}

function printSpinnerHelp() {
  console.log(`Usage: nemoclawd spinners <command>

Commands:
  list                         List bundled spinner packs
  install <pack>               Install a pack into Clawd settings
  remove                       Remove custom spinner verbs
  show <pack>                  Print verbs in a pack

Options:
  --settings <path>            Use a specific settings.json file
  --json                       Print machine-readable output where supported`);
}

function printSpinnerList(jsonOutput = false) {
  const rows = listSpinnerPacks().map((name) => ({
    name,
    description: PACK_DESCRIPTIONS[name] || "",
  }));

  if (jsonOutput) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.log("Bundled spinner packs:");
  for (const row of rows) {
    const suffix = row.description ? ` - ${row.description}` : "";
    console.log(`  ${row.name}${suffix}`);
  }
}

function showSpinnerPack(packName, jsonOutput = false) {
  const pack = readSpinnerPack(packName);
  if (jsonOutput) {
    console.log(JSON.stringify(pack.spinnerVerbs, null, 2));
    return;
  }

  console.log(`${packName}:`);
  for (const verb of pack.spinnerVerbs.verbs) {
    console.log(`  ${verb}`);
  }
}

function spinnersCommand(args) {
  const { opts, positionals } = parseSpinnerArgs(args);
  const subcommand = positionals[0] || "list";

  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    printSpinnerHelp();
    return;
  }
  if (subcommand === "list" || subcommand === "ls") {
    printSpinnerList(opts.json);
    return;
  }
  if (subcommand === "show" || subcommand === "preview") {
    const packName = positionals[1];
    if (!packName) throw new Error("Usage: nemoclawd spinners show <pack>");
    showSpinnerPack(packName, opts.json);
    return;
  }
  if (subcommand === "install" || subcommand === "use") {
    const packName = positionals[1];
    if (!packName) throw new Error("Usage: nemoclawd spinners install <pack>");
    const result = installSpinnerPack(packName, opts);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Spinner pack "${result.packName}" installed successfully.`);
    console.log(`Updated: ${result.settingsPath}`);
    console.log(`Loaded ${result.verbCount} spinner verbs.`);
    return;
  }
  if (subcommand === "remove" || subcommand === "reset") {
    const result = removeSpinnerPack(opts);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log("Spinner pack removed. Default spinners are back.");
    console.log(`Updated: ${result.settingsPath}`);
    return;
  }
  if (listSpinnerPacks().includes(subcommand)) {
    const result = installSpinnerPack(subcommand, opts);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Spinner pack "${result.packName}" installed successfully.`);
    console.log(`Updated: ${result.settingsPath}`);
    console.log(`Loaded ${result.verbCount} spinner verbs.`);
    return;
  }

  throw new Error(`Unknown spinners command or pack: ${subcommand}`);
}

module.exports = {
  SPINNERS_DIR,
  installSpinnerPack,
  listSpinnerPacks,
  removeSpinnerPack,
  resolveSettingsPath,
  spinnersCommand,
};
