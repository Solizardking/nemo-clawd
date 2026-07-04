/**
 * Open Clawd v3 — CODE MODE
 * Write, review, and ship production code.
 * Supports: xAI Grok | Anthropic Claude (streaming) | DeepSeek | OpenRouter
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { resolveProvider } from '../providers/index.mjs';

const CODE_SYSTEM = `You are Open Clawd Code. Ship production TypeScript/Solana/JavaScript code only. No prose. Just code with brief inline comments where the WHY is non-obvious. Include imports, types, error handling. Format for .ts files unless the prompt specifies otherwise.`;

export class CodeMode {
    constructor(config = {}) {
        this.config = config;
    }

    async run(args = []) {
        const prompt = args.filter((a) => !a.startsWith('--')).join(' ');

        if (!prompt.trim()) {
            console.error('[CODE MODE] No prompt given. Usage: clawd code "Build a Jupiter swap bot"');
            return;
        }

        const useStream = this.config.stream ?? (process.env.CLAWD_STREAM === 'true');
        const { name, client } = resolveProvider(this.config.provider);

        if (!client) {
            console.error(`[CODE MODE] No API key for provider "${name}". Set ${providerKeyName(name)} in your .env`);
            return;
        }

        console.log(`\n[CODE MODE] Provider: ${name} | Model: ${this.config.model || 'default'} | Stream: ${useStream}`);
        console.log(`[CODE MODE] Prompt: ${prompt}\n`);

        const code = useStream
            ? await this.generateStreaming(prompt, client, name)
            : await this.generateBlocking(prompt, client, name);

        const outputDir = path.join(process.cwd(), 'outputs');
        fs.mkdirSync(outputDir, { recursive: true });
        const filename = `clawd-code-${Date.now()}.ts`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, code);
        console.log(`\n[CODE MODE] Written: ${filepath}`);

        if (fs.existsSync(path.join(process.cwd(), 'tsconfig.json'))) {
            console.log('[CODE MODE] Running TypeScript check...');
            try {
                execSync('npx tsc --noEmit', { stdio: 'inherit' });
                console.log('[CODE MODE] ✓ TypeScript check passed');
            } catch {
                console.log('[CODE MODE] ⚠ TypeScript errors (see above)');
            }
        }
    }

    async generateStreaming(prompt, client, name) {
        const chunks = [];
        process.stdout.write('[CODE MODE] Streaming:\n\n');
        try {
            for await (const chunk of client.stream({
                model: this.resolveModel(name),
                system: CODE_SYSTEM,
                messages: [{ role: 'user', content: prompt }],
                maxTokens: 8096,
            })) {
                const text = chunk.text || '';
                process.stdout.write(text);
                chunks.push(text);
            }
            process.stdout.write('\n');
            return chunks.join('');
        } catch (err) {
            console.log(`\n[CODE MODE] Stream error: ${err.message} — retrying blocking`);
            return this.generateBlocking(prompt, client, name);
        }
    }

    async generateBlocking(prompt, client, name) {
        const model = this.resolveModel(name);
        console.log(`[CODE MODE] Generating (${name}/${model})...`);
        try {
            const { content } = await client.chat({
                model,
                system: CODE_SYSTEM,
                messages: [{ role: 'user', content: prompt }],
                maxTokens: 8096,
                temperature: 0.7,
            });
            return content || fallbackCode(prompt, 'empty response');
        } catch (err) {
            return fallbackCode(prompt, err.message);
        }
    }

    resolveModel(name) {
        if (this.config.model) return this.config.model;
        const defaults = {
            xai: 'grok-4.3',
            anthropic: 'claude-sonnet-4-6',
            deepseek: 'deepseek-chat',
            openrouter: process.env.OPENROUTER_FREE_MODEL || 'nex-agi/nex-n2-pro:free',
        };
        return defaults[name] || 'grok-4.3';
    }
}

function providerKeyName(name) {
    const map = { xai: 'XAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', deepseek: 'DEEPSEEK_API_KEY', openrouter: 'OPENROUTER_API_KEY' };
    return map[name] || 'XAI_API_KEY';
}

function fallbackCode(prompt, reason) {
    return `// Open Clawd v3 — Code placeholder\n// Reason: ${reason}\n// Add the appropriate API key to ~/.clawd/.env and re-run.\n\n// Prompt: ${prompt}\n\nexport {};\n`;
}
