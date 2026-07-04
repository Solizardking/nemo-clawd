/**
 * Multi-Provider AI Client — Open Clawd v3
 *
 * Unified chat/stream/responses interface for:
 *   xAI Grok   — primary, web_search + x_search + code_interpreter tools
 *   Anthropic  — streaming-native, claude-sonnet-4-6 / opus / haiku
 *   DeepSeek   — reasoning (thinking) + high-effort multi-step
 *   OpenRouter — free-tier fallback, 300+ models
 *
 * All clients speak a common { content, citations } response shape.
 */

import https from 'https';

// ─── Shared fetch helper ────────────────────────────────────────────────────

function postJSON(url, headers, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const parsed = new URL(url);
        const req = https.request(
            {
                hostname: parsed.hostname,
                port: parsed.port || 443,
                path: parsed.pathname + parsed.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    ...headers,
                },
            },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                    catch { resolve({ status: res.statusCode, body: data }); }
                });
            },
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function* streamSSE(url, headers, body) {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    yield* await new Promise((resolve, reject) => {
        const chunks = [];
        const req = https.request(
            {
                hostname: parsed.hostname,
                port: parsed.port || 443,
                path: parsed.pathname + parsed.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    Accept: 'text/event-stream',
                    ...headers,
                },
            },
            (res) => {
                let buf = '';
                res.on('data', (chunk) => {
                    buf += chunk.toString();
                    const lines = buf.split('\n');
                    buf = lines.pop();
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const raw = line.slice(6).trim();
                            if (raw === '[DONE]') return;
                            try { chunks.push(JSON.parse(raw)); } catch { /* skip */ }
                        }
                    }
                });
                res.on('end', () => resolve(chunks));
                res.on('error', reject);
            },
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ─── xAI / Grok ─────────────────────────────────────────────────────────────

export function createXaiClient(apiKey) {
    if (!apiKey) return null;
    const BASE = 'https://api.x.ai/v1';
    const AUTH = { Authorization: `Bearer ${apiKey}` };

    return {
        async chat({ model = 'grok-4.3', messages, system, maxTokens = 8096, temperature = 0.7 }) {
            const body = {
                model,
                messages: system
                    ? [{ role: 'system', content: system }, ...messages]
                    : messages,
                max_tokens: maxTokens,
                temperature,
            };
            const { body: resp } = await postJSON(`${BASE}/chat/completions`, AUTH, body);
            const content = resp.choices?.[0]?.message?.content || '';
            return { content, citations: [] };
        },

        async responses({ model = 'grok-4.20-multi-agent', input, tools = [], reasoning }) {
            const body = { model, input, tools };
            if (reasoning) body.reasoning = reasoning;
            const { body: resp } = await postJSON(`${BASE}/responses`, AUTH, body);
            const output = resp.output || [];
            const texts = output
                .filter((o) => o.type === 'message')
                .flatMap((o) => o.content || [])
                .filter((c) => c.type === 'output_text')
                .map((c) => c.text);
            const citations = output
                .filter((o) => o.type === 'message')
                .flatMap((o) => o.content || [])
                .filter((c) => c.type === 'output_text')
                .flatMap((c) => c.citations || [])
                .map((c) => c.url || c.title || JSON.stringify(c));
            return { content: texts.join('\n'), citations };
        },

        async *stream({ model = 'grok-4.3', messages, system, maxTokens = 8096 }) {
            const body = {
                model,
                messages: system
                    ? [{ role: 'system', content: system }, ...messages]
                    : messages,
                max_tokens: maxTokens,
                stream: true,
            };
            for await (const chunk of streamSSE(`${BASE}/chat/completions`, AUTH, body)) {
                const text = chunk.choices?.[0]?.delta?.content;
                if (text) yield { text };
            }
        },
    };
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';

export function createAnthropicClient(apiKey) {
    if (!apiKey) return null;
    const BASE = 'https://api.anthropic.com/v1';
    const AUTH = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
    };

    return {
        async chat({ model = DEFAULT_CLAUDE_MODEL, system, messages, maxTokens = 8096, temperature = 0.7 }) {
            const body = { model, max_tokens: maxTokens, temperature, messages };
            if (system) body.system = system;
            const { body: resp } = await postJSON(`${BASE}/messages`, AUTH, body);
            const content = resp.content?.[0]?.text || '';
            return { content, citations: [] };
        },

        async *stream({ model = DEFAULT_CLAUDE_MODEL, system, messages, maxTokens = 8096 }) {
            const body = {
                model,
                max_tokens: maxTokens,
                messages,
                stream: true,
            };
            if (system) body.system = system;
            for await (const chunk of streamSSE(`${BASE}/messages`, AUTH, body)) {
                if (chunk.type === 'content_block_delta') {
                    const text = chunk.delta?.text;
                    if (text) yield { text };
                }
            }
        },
    };
}

// ─── DeepSeek ────────────────────────────────────────────────────────────────

export function createDeepSeekClient(apiKey, baseUrl = 'https://api.deepseek.com') {
    if (!apiKey) return null;
    const BASE = baseUrl.replace(/\/$/, '') + '/v1';
    const AUTH = { Authorization: `Bearer ${apiKey}` };

    return {
        async chat({ model = 'deepseek-chat', messages, maxTokens = 8096, temperature = 0.7, reasoningEffort, thinking }) {
            const body = { model, messages, max_tokens: maxTokens, temperature };
            if (reasoningEffort) body.reasoning_effort = reasoningEffort;
            if (thinking) body.thinking = true;
            const { body: resp } = await postJSON(`${BASE}/chat/completions`, AUTH, body);
            const content = resp.choices?.[0]?.message?.content || '';
            return { content, citations: [] };
        },

        async *stream({ model = 'deepseek-chat', messages, maxTokens = 8096 }) {
            const body = { model, messages, max_tokens: maxTokens, stream: true };
            for await (const chunk of streamSSE(`${BASE}/chat/completions`, AUTH, body)) {
                const text = chunk.choices?.[0]?.delta?.content;
                if (text) yield { text };
            }
        },
    };
}

// ─── OpenRouter ──────────────────────────────────────────────────────────────

export const DEFAULT_OPENROUTER_MODEL = 'nex-agi/nex-n2-pro:free';

export function createOpenRouterClient(apiKey, model) {
    if (!apiKey) return null;
    const BASE = 'https://openrouter.ai/api/v1';
    const AUTH = {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://open-clawd.local',
        'X-Title': 'Open Clawd v3',
    };
    const defaultModel = model || process.env.OPENROUTER_FREE_MODEL || DEFAULT_OPENROUTER_MODEL;

    return {
        getDefaultModel: () => defaultModel,

        async chat({ model: m = defaultModel, messages, system, maxTokens = 8096, temperature = 0.7 }) {
            const msgs = system
                ? [{ role: 'system', content: system }, ...messages]
                : messages;
            const body = { model: m, messages: msgs, max_tokens: maxTokens, temperature };
            const { body: resp } = await postJSON(`${BASE}/chat/completions`, AUTH, body);
            const content = resp.choices?.[0]?.message?.content || '';
            return { content, citations: [] };
        },

        async *stream({ model: m = defaultModel, messages, max_tokens = 8096 }) {
            const body = { model: m, messages, max_tokens, stream: true };
            for await (const chunk of streamSSE(`${BASE}/chat/completions`, AUTH, body)) {
                const text = chunk.choices?.[0]?.delta?.content;
                if (text) yield { text };
            }
        },
    };
}

// ─── Provider factory ────────────────────────────────────────────────────────

/**
 * Resolve the best available client from env.
 * Priority: XAI_API_KEY > ANTHROPIC_API_KEY > DEEPSEEK_API_KEY > OPENROUTER_API_KEY
 */
export function resolveProvider(overrideProvider, env = process.env) {
    const p = (overrideProvider || env.CLAWD_PROVIDER || 'xai').toLowerCase();

    if (p === 'anthropic' || p === 'claude' || p === 'ant') {
        const key = env.ANTHROPIC_API_KEY;
        return { name: 'anthropic', client: createAnthropicClient(key), key };
    }
    if (p === 'deepseek' || p === 'ds') {
        const key = env.DEEPSEEK_API_KEY;
        return { name: 'deepseek', client: createDeepSeekClient(key, env.DEEPSEEK_BASE_URL), key };
    }
    if (p === 'openrouter' || p === 'or') {
        const key = env.OPENROUTER_API_KEY;
        return { name: 'openrouter', client: createOpenRouterClient(key), key };
    }

    // Default xAI
    const key = env.XAI_API_KEY || env.GROK_API_KEY;
    return { name: 'xai', client: createXaiClient(key), key };
}
