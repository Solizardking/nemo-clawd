/**
 * Open Clawd v3 — REPL MODE
 * Interactive multi-turn conversation with persistent history.
 * Supports all providers and slash commands.
 */

import readline from 'readline';
import { resolveProvider } from '../providers/index.mjs';

const SYSTEM = `You are Open Clawd — a lobster-grade Solana-native AI assistant. Be precise and concise. Paper-first for all trading workflows. Use slash commands to switch modes.`;

export class ReplMode {
    constructor(config = {}) {
        this.config = config;
        this.history = [];
        this.model = config.model;
    }

    async run() {
        const { name, client } = resolveProvider(this.config.provider);

        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║  CLAWD REPL — Interactive Mode                         ║');
        console.log(`║  Provider: ${(name).padEnd(48)}║`);
        console.log('║  /help for commands, /quit to exit                     ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'clawd> ',
        });

        rl.prompt();

        for await (const line of rl) {
            const input = line.trim();
            if (!input) { rl.prompt(); continue; }

            if (input === '/quit' || input === '/exit' || input === 'exit') {
                console.log('[REPL] Goodbye.');
                rl.close();
                break;
            }

            if (input === '/help') {
                console.log('\n  /clear    — clear conversation');
                console.log('  /history  — show message count');
                console.log('  /model    — show current model');
                console.log('  /quit     — exit REPL\n');
                rl.prompt();
                continue;
            }

            if (input === '/clear') {
                this.history = [];
                console.log('[REPL] Conversation cleared.');
                rl.prompt();
                continue;
            }

            if (input === '/history') {
                console.log(`[REPL] ${this.history.length} messages in history.`);
                rl.prompt();
                continue;
            }

            if (input.startsWith('/model')) {
                const m = input.split(' ')[1];
                if (m) { this.model = m; console.log(`[REPL] Model → ${m}`); }
                else console.log(`[REPL] Model: ${this.model || 'default'}`);
                rl.prompt();
                continue;
            }

            this.history.push({ role: 'user', content: input });

            if (!client) {
                console.log(`\n[REPL] No API key for "${name}". Set ${name.toUpperCase()}_API_KEY.\n`);
                rl.prompt();
                continue;
            }

            try {
                process.stdout.write('\nclawd: ');
                let reply = '';
                const model = this.model || defaultModel(name);

                const stream = client.stream?.({
                    model,
                    system: SYSTEM,
                    messages: this.history,
                    maxTokens: 4096,
                });

                if (stream) {
                    for await (const chunk of stream) {
                        const text = chunk.text || '';
                        process.stdout.write(text);
                        reply += text;
                    }
                } else {
                    const resp = await client.chat({
                        model,
                        system: SYSTEM,
                        messages: this.history,
                        maxTokens: 4096,
                    });
                    reply = resp.content || '';
                    process.stdout.write(reply);
                }

                process.stdout.write('\n\n');
                this.history.push({ role: 'assistant', content: reply });
            } catch (err) {
                console.error(`\n[REPL] Error: ${err.message}\n`);
            }

            rl.prompt();
        }
    }
}

function defaultModel(name) {
    const m = { xai: 'grok-4.3', anthropic: 'claude-sonnet-4-6', deepseek: 'deepseek-chat', openrouter: 'nex-agi/nex-n2-pro:free' };
    return m[name] || 'grok-4.3';
}
