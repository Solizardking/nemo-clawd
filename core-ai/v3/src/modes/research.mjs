/**
 * Open Clawd v3 — RESEARCH MODE
 * Multi-agent deep research.
 * xAI: grok-4.20-multi-agent with web_search + x_search + code_interpreter
 * Anthropic / OpenRouter: streaming synthesis
 * DeepSeek: high-effort reasoning (thinking mode)
 */

import { resolveProvider, createXaiClient } from '../providers/index.mjs';

const RESEARCH_SYSTEM = `You are Open Clawd Research — a precise, source-aware technical researcher. Synthesize findings across sources. Cite evidence inline. Flag what requires live verification. Be structured and concise.`;

export class ResearchMode {
    constructor(config = {}) {
        this.config = config;
    }

    async run(args = []) {
        const query = args.filter((a) => !a.startsWith('--')).join(' ');

        if (!query.trim()) {
            console.error('[RESEARCH MODE] No query. Usage: clawd research "AI agent frameworks 2025"');
            return;
        }

        const agentCount = this.config.agentCount ?? 4;
        const useStream = this.config.stream ?? false;
        const { name, client } = resolveProvider(this.config.provider);

        if (!client) {
            console.error(`[RESEARCH MODE] No API key for "${name}"`);
            return;
        }

        this.printHeader(query, agentCount, name);

        if (name === 'xai') {
            const xaiClient = createXaiClient(process.env.XAI_API_KEY || process.env.GROK_API_KEY);
            const { content, citations } = await xaiClient.responses({
                model: this.config.model || 'grok-4.20-multi-agent',
                reasoning: { effort: agentCount >= 16 ? 'high' : 'low' },
                input: [{ role: 'user', content: query }],
                tools: [{ type: 'web_search' }, { type: 'x_search' }, { type: 'code_interpreter' }],
            });
            console.log(`\n${content}`);
            if (citations.length > 0) {
                console.log('\n--- Sources ---');
                for (const c of citations) console.log(`  • ${c}`);
            }
        } else if (useStream && (name === 'anthropic' || name === 'openrouter')) {
            process.stdout.write('\n');
            for await (const chunk of client.stream({
                model: this.resolveModel(name),
                system: RESEARCH_SYSTEM,
                messages: [{ role: 'user', content: query }],
                maxTokens: 8096,
            })) {
                process.stdout.write(chunk.text || '');
            }
            process.stdout.write('\n');
        } else {
            const { content, citations } = await client.chat({
                model: this.resolveModel(name),
                system: RESEARCH_SYSTEM,
                messages: [{ role: 'user', content: query }],
                maxTokens: 8096,
                temperature: 0.2,
                ...(name === 'deepseek' ? { reasoningEffort: agentCount >= 16 ? 'high' : 'medium', thinking: true } : {}),
            });
            console.log(`\n${content}`);
            if (citations?.length > 0) {
                console.log('\n--- Sources ---');
                for (const c of citations) console.log(`  • ${c}`);
            }
        }

        console.log('\n[RESEARCH MODE] Done. Say "code <task>" to generate implementation.');
    }

    printHeader(query, agentCount, provider) {
        const label = `${provider} · ${agentCount} agents`;
        const q = query.substring(0, 52).padEnd(52);
        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log(`║  RESEARCH MODE — ${label.padEnd(45)}║`);
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║  ${q}  ║`);
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
    }

    resolveModel(name) {
        if (this.config.model) return this.config.model;
        const defaults = {
            xai: 'grok-4.20-multi-agent',
            anthropic: 'claude-sonnet-4-6',
            deepseek: 'deepseek-chat',
            openrouter: process.env.OPENROUTER_FREE_MODEL || 'nex-agi/nex-n2-pro:free',
        };
        return defaults[name] || 'grok-4.20-multi-agent';
    }
}
