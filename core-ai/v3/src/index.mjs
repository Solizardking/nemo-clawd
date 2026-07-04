#!/usr/bin/env node
/**
 * Open Clawd v3
 *
 * Unified Grok-first AI coding, trading, research, image, and voice CLI.
 *
 * Architecture (merged from three packages):
 *   v2          — agent loop, 25+ tools, MCP, permissions, hooks, settings, Ink TUI
 *   clawd-code  — modes: code / trade / research / image / voice / repl
 *   clawd-grok  — storage patterns, scheduler, LSP awareness
 *
 * Gallery / ObjectStore fix:
 *   All image outputs now go to LocalGallery (local filesystem)
 *   instead of Replit ObjectStore. The [ObjectStore] warning is eliminated.
 *
 * Providers: xAI Grok | Anthropic Claude | DeepSeek | OpenRouter
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { resolveProvider } from './providers/index.mjs';
import { LocalGallery } from './storage/gallery.mjs';

// ─── Config ──────────────────────────────────────────────────────────────────

function loadEnv() {
    const files = [
        path.join(os.homedir(), '.clawd', '.env'),
        path.join(os.homedir(), '.clawd-code', '.env'),
        path.join(process.cwd(), '.env'),
    ];
    for (const f of files) {
        if (!fs.existsSync(f)) continue;
        for (const line of fs.readFileSync(f, 'utf-8').split('\n')) {
            const l = line.trim();
            if (!l || l.startsWith('#')) continue;
            const norm = l.startsWith('export ') ? l.slice(7).trim() : l;
            const idx = norm.indexOf('=');
            if (idx === -1) continue;
            const key = norm.slice(0, idx).trim();
            let val = norm.slice(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (process.env[key] === undefined) process.env[key] = val;
        }
    }
}

function buildConfig(args) {
    return {
        provider: getFlag(args, '--provider') || process.env.CLAWD_PROVIDER || 'xai',
        model: getFlag(args, '--model') || process.env.CLAWD_MODEL,
        stream: args.includes('--stream') || process.env.CLAWD_STREAM === 'true',
        liveTrading: args.includes('--live') || process.env.LIVE_TRADING === 'true',
        operatorConfirmed: process.env.OPERATOR_CONFIRMED === 'true',
        agentCount: parseInt(getFlag(args, '--agents') || process.env.CLAWD_AGENT_COUNT || '4', 10),
        xaiApiKey: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        deepSeekApiKey: process.env.DEEPSEEK_API_KEY,
        openAiKey: process.env.OPENAI_API_KEY,
        rpcUrl: process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || buildHeliusUrl(),
        perpsMaxNotional: 250,
        perpsMaxLeverage: 3,
    };
}

function buildHeliusUrl() {
    const key = process.env.HELIUS_API_KEY;
    return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : 'https://api.mainnet-beta.solana.com';
}

function getFlag(args, flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function repoRoot() {
    return path.resolve(import.meta.dirname, '../..');
}

function spawnInherit(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            env: process.env,
        });
        child.on('error', reject);
        child.on('close', (code) => resolve(code ?? 0));
    });
}

async function runDelegatedRuntime(kind, args) {
    const root = repoRoot();

    if (kind === 'clawd-code') {
        const pkgDir = path.join(root, 'clawd-code');
        const builtEntry = path.join(pkgDir, 'dist', 'cli.js');
        const sourceEntry = path.join(pkgDir, 'src', 'cli.ts');
        if (fs.existsSync(builtEntry)) return spawnInherit('node', [builtEntry, ...args], pkgDir);
        return spawnInherit('npx', ['tsx', sourceEntry, ...args], pkgDir);
    }

    if (kind === 'clawd-grok') {
        const pkgDir = path.join(root, 'clawd-grok');
        const builtEntry = path.join(pkgDir, 'dist', 'index.js');
        const sourceEntry = path.join(pkgDir, 'src', 'index.ts');
        if (fs.existsSync(builtEntry)) return spawnInherit('bun', [builtEntry, ...args], pkgDir);
        return spawnInherit('bun', [sourceEntry, ...args], pkgDir);
    }

    if (kind === 'mcp-server') {
        const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] || '0', 10);
        if (nodeMajor >= 25) {
            console.error('[CLAWD] mcp-server is wired into the monorepo, but its current MCP SDK dependency is not compatible with Node ' + process.versions.node + '.');
            console.error('[CLAWD] Use Node 18-22 for `clawd mcp ...`, or run the package in a pinned runtime before starting the server.');
            return 1;
        }
        const pkgDir = path.join(root, 'mcp-server');
        const builtEntry = path.join(pkgDir, 'dist', 'index.js');
        const sourceEntry = path.join(pkgDir, 'src', 'index.ts');
        if (fs.existsSync(builtEntry)) return spawnInherit('node', [builtEntry, ...args], pkgDir);
        return spawnInherit('npx', ['tsx', sourceEntry, ...args], pkgDir);
    }

    throw new Error(`Unknown delegated runtime: ${kind}`);
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function printBanner() {
    console.log(`
\x1b[36m╔═══════════════════════════════════════════════════════════════╗
║  🦞 OPEN CLAWD v3                                             ║
║  Grok-first AI coding, trading, research, image & voice CLI   ║
║  xAI · Anthropic · DeepSeek · OpenRouter · Solana · Phoenix   ║
╚═══════════════════════════════════════════════════════════════╝\x1b[0m`);
}

function printUsage() {
    printBanner();
    console.log(`
USAGE:
  clawd [mode] [args] [options]

MODES:
  code       Write, review, and ship production code
  trade      Perpetuals trading with Phoenix Rise + Vulcan CLI
  research   Multi-agent deep research (Grok web_search + x_search)
  image      Generate images via xAI Grok Imagine or DALL-E 3
  voice      Text-to-speech (xAI or system TTS)
  repl       Interactive multi-turn conversation REPL

COMMANDS (alias-friendly):
  /verify    Check environment and API keys
  /models    List models / switch model
  /provider  Show or switch AI provider
  /gallery   Show image gallery status
  legacy     Delegate to the original TypeScript clawd-code CLI
  grok       Delegate to the Bun-based clawd-grok runtime
  mcp        Start the Pump MCP server from this monorepo
  /help      Show this help

EXAMPLES:
  clawd code "Build a Jupiter swap bot"
  clawd code --stream --provider anthropic "Review this TypeScript"
  clawd trade "SOL funding rate?"
  clawd trade "short SOL $100"
  clawd research --agents 16 "Solana perps funding arb strategies"
  clawd image "cyberpunk Solana trading desk"
  clawd voice "Hello from Clawd"
  clawd repl
  clawd legacy code "Build a Jupiter swap bot"
  clawd grok --prompt "show me SOL perps orderbook depth"
  clawd mcp --http

OPTIONS:
  --provider <name>   xai | anthropic | openrouter | deepseek
  --model <id>        Override model for this run
  --stream            Stream tokens token-by-token
  --agents <n>        Agent count for research (4 | 16)
  --live              Enable live trading (requires ARM env flags)
  --paper             Paper trading mode (default)

ENVIRONMENT (~/.clawd/.env or .env):
  XAI_API_KEY            xAI Grok models (primary)
  ANTHROPIC_API_KEY      Claude Sonnet/Opus/Haiku
  DEEPSEEK_API_KEY       DeepSeek v4 Pro / Flash
  OPENROUTER_API_KEY     Free + paid models
  OPENAI_API_KEY         DALL-E 3 image generation
  HELIUS_API_KEY         Solana RPC + DAS
  SOLANA_RPC_URL         Solana RPC endpoint
  LIVE_TRADING           true to enable live trading
  OPERATOR_CONFIRMED     true to confirm operator intent
  CLAWD_PROVIDER         Default provider (xai)
  CLAWD_MODEL            Default model override
  CLAWD_STREAM           true to stream by default
  CLAWD_AGENT_COUNT      Research agent count (4 | 16)

Gallery: images saved to ~/.clawd/gallery/ (no Replit ObjectStore needed)
`);
}

// ─── Verify ───────────────────────────────────────────────────────────────────

function runVerify() {
    console.log('\n[VERIFY] Open Clawd v3 environment check\n');

    const checks = [
        ['XAI_API_KEY', 'xAI Grok (primary)', true],
        ['ANTHROPIC_API_KEY', 'Anthropic Claude', false],
        ['DEEPSEEK_API_KEY', 'DeepSeek', false],
        ['OPENROUTER_API_KEY', 'OpenRouter (free fallback)', false],
        ['OPENAI_API_KEY', 'DALL-E 3 images', false],
        ['HELIUS_API_KEY', 'Helius RPC / DAS', false],
        ['SOLANA_RPC_URL', 'Solana RPC', false],
    ];

    let hasAnyKey = false;
    for (const [key, label, primary] of checks) {
        const val = process.env[key];
        const set = !!val;
        if (set) hasAnyKey = true;
        const mask = val ? `${val.slice(0, 6)}...${val.slice(-4)}` : '(unset)';
        const icon = set ? '✓' : (primary ? '✗' : '–');
        console.log(`  ${icon}  ${label.padEnd(30)} ${key} = ${mask}`);
    }

    const gallery = new LocalGallery();
    console.log(`\n  ✓  Gallery: ${gallery.dir}`);
    console.log(`     Items:   ${gallery.list().length}`);

    console.log('');
    if (!hasAnyKey) {
        console.log('[VERIFY] ✗ No API keys set. Copy .env.example to ~/.clawd/.env and add keys.');
        return false;
    }
    console.log('[VERIFY] ✓ Environment ready.');
    return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    loadEnv();
    const args = process.argv.slice(2);

    if (args[0] === 'legacy' || args[0] === 'clawd-code') {
        const code = await runDelegatedRuntime('clawd-code', args.slice(1));
        process.exit(code);
    }

    if (args[0] === 'grok' || args[0] === 'clawd-grok') {
        const code = await runDelegatedRuntime('clawd-grok', args.slice(1));
        process.exit(code);
    }

    if (args[0] === 'mcp' || args[0] === 'pump-mcp') {
        const code = await runDelegatedRuntime('mcp-server', args.slice(1));
        process.exit(code);
    }

    if (args.length === 0 || args.includes('--help') || args.includes('-h') || args[0] === '/help' || args[0] === 'help') {
        printUsage();
        process.exit(0);
    }

    if (args[0] === '/verify' || args[0] === 'verify') {
        process.exit(runVerify() ? 0 : 1);
    }

    if (args[0] === '/gallery' || args[0] === 'gallery') {
        const g = new LocalGallery();
        g.printStatus();
        const items = g.list(10);
        if (items.length > 0) {
            console.log('\nRecent:');
            for (const i of items) {
                console.log(`  ${i.mtime.toISOString().slice(0, 10)}  ${i.name}  (${(i.size / 1024).toFixed(1)} KB)`);
            }
        }
        process.exit(0);
    }

    if (args[0] === '/provider' || args[0] === 'provider') {
        const { name, key } = resolveProvider(args[1]);
        if (args[1]) {
            console.log(`[CLAWD] Switched provider: ${name}`);
            console.log(`  Set CLAWD_PROVIDER=${name} in ~/.clawd/.env to persist.`);
        } else {
            const current = resolveProvider();
            console.log(`\n[CLAWD] Current provider: ${current.name}`);
            console.log(`  Key: ${current.key ? `${current.key.slice(0, 6)}...` : '(unset)'}`);
            console.log('\n  Available: xai | anthropic | deepseek | openrouter');
            console.log('  Switch: clawd /provider anthropic');
        }
        process.exit(0);
    }

    if (args[0] === '/models' || args[0] === 'models') {
        console.log('\n  xAI Grok:');
        console.log('    grok-4.3                 (default, fast)');
        console.log('    grok-4.20-multi-agent    (research, web_search)');
        console.log('    grok-imagine-image-quality (image gen)');
        console.log('\n  Anthropic Claude:');
        console.log('    claude-sonnet-4-6        (balanced)');
        console.log('    claude-opus-4-8          (most capable)');
        console.log('    claude-haiku-4-5-20251001 (fast)');
        console.log('\n  DeepSeek:');
        console.log('    deepseek-chat            (v4 pro)');
        console.log('\n  Switch: clawd --model grok-4.3 code "..."');
        process.exit(0);
    }

    const config = buildConfig(args);
    const mode = args[0]?.toLowerCase();
    const modeArgs = args.slice(1).filter((a) => {
        // strip consumed flags
        const skip = ['--provider', '--model', '--agents', '--stream', '--live', '--paper'];
        return !skip.some((f) => a === f || args[args.indexOf(f) + 1] === a);
    });

    printBanner();
    const { name } = resolveProvider(config.provider);
    console.log(`\n  Mode: ${(mode || 'code').toUpperCase()}  Provider: ${name}  Model: ${config.model || 'default'}\n`);

    try {
        switch (mode) {
            case 'code': {
                const { CodeMode } = await import('./modes/code.mjs');
                await new CodeMode(config).run(modeArgs);
                break;
            }
            case 'trade': {
                const { TradeMode } = await import('./modes/trade.mjs');
                await new TradeMode(config).run(modeArgs);
                break;
            }
            case 'research': {
                const { ResearchMode } = await import('./modes/research.mjs');
                await new ResearchMode(config).run(modeArgs);
                break;
            }
            case 'image': {
                const { ImageMode } = await import('./modes/image.mjs');
                await new ImageMode(config).run(modeArgs);
                break;
            }
            case 'voice': {
                const { VoiceMode } = await import('./modes/voice.mjs');
                await new VoiceMode(config).run(modeArgs);
                break;
            }
            case 'repl': {
                const { ReplMode } = await import('./modes/repl.mjs');
                await new ReplMode(config).run();
                break;
            }
            default: {
                // No mode specified — run agent loop if available, else code mode
                const allArgs = args.filter((a) => !['--stream', '--live', '--paper'].includes(a));
                const prompt = allArgs.filter((a) => !a.startsWith('--')).join(' ');

                if (!prompt) {
                    // Try to start interactive Ink TUI from v2
                    try {
                        const v2Index = path.resolve(import.meta.dirname, '../../v2/src/index.mjs');
                        if (fs.existsSync(v2Index)) {
                            console.log('[CLAWD] Starting v2 agent loop...');
                            await import(v2Index);
                        } else {
                            const { ReplMode } = await import('./modes/repl.mjs');
                            await new ReplMode(config).run();
                        }
                    } catch {
                        const { ReplMode } = await import('./modes/repl.mjs');
                        await new ReplMode(config).run();
                    }
                } else {
                    const { CodeMode } = await import('./modes/code.mjs');
                    await new CodeMode(config).run(allArgs);
                }
            }
        }
    } catch (err) {
        console.error(`[CLAWD] Error: ${err.message}`);
        if (process.env.CLAWD_DEBUG === 'true') console.error(err.stack);
        process.exit(1);
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
