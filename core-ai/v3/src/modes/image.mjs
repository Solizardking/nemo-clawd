/**
 * Open Clawd v3 — IMAGE MODE
 *
 * Generates images via xAI Grok Imagine, DALL-E 3, or Gemini.
 * Saves all outputs to the LocalGallery (local filesystem) instead of
 * Replit ObjectStore — eliminates:
 *   [ObjectStore] Replit object storage disabled; using in-memory gallery fallback
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { LocalGallery } from '../storage/gallery.mjs';
import { createXaiClient, createAnthropicClient } from '../providers/index.mjs';

const gallery = new LocalGallery();

export class ImageMode {
    constructor(config = {}) {
        this.config = config;
    }

    async run(args = []) {
        const prompt = args.filter((a) => !a.startsWith('--')).join(' ');

        if (!prompt.trim()) {
            console.error('[IMAGE MODE] No prompt given. Usage: clawd image "cyberpunk Solana trading desk"');
            return;
        }

        let size = '1024x1024';
        let model = null;

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--size' && args[i + 1]) size = args[i + 1];
            if (args[i] === '--model' && args[i + 1]) model = args[i + 1];
        }

        console.log('\n[IMAGE MODE] Generating image...');
        console.log(`[IMAGE MODE] Prompt: ${prompt}`);
        console.log(`[IMAGE MODE] Size: ${size}`);
        gallery.printStatus();
        console.log('');

        // Provider priority: xAI Imagine > DALL-E > Gemini placeholder
        const xaiKey = this.config.xaiApiKey || process.env.XAI_API_KEY;
        const openaiKey = this.config.openAiKey || process.env.OPENAI_API_KEY;

        if (xaiKey && (!model || model.startsWith('grok'))) {
            await this.generateWithGrokImagine(prompt, size, xaiKey);
        } else if (openaiKey && (!model || model.startsWith('dall'))) {
            await this.generateWithDalle(prompt, size, openaiKey);
        } else {
            await this.generatePlaceholder(prompt, size);
        }
    }

    async generateWithGrokImagine(prompt, size, apiKey) {
        console.log('[IMAGE MODE] Provider: xAI Grok Imagine');
        const model = this.config.model || process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-quality';

        try {
            const body = JSON.stringify({ model, prompt, n: 1, size, response_format: 'url' });
            const { imageUrl, b64 } = await new Promise((resolve, reject) => {
                const parsed = new URL('https://api.x.ai/v1/images/generations');
                const req = https.request(
                    {
                        hostname: parsed.hostname,
                        port: 443,
                        path: parsed.pathname,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(body),
                            Authorization: `Bearer ${apiKey}`,
                        },
                    },
                    (res) => {
                        let data = '';
                        res.on('data', (c) => (data += c));
                        res.on('end', () => {
                            try {
                                const resp = JSON.parse(data);
                                const item = resp.data?.[0];
                                resolve({ imageUrl: item?.url, b64: item?.b64_json });
                            } catch { reject(new Error('Parse error')); }
                        });
                    },
                );
                req.on('error', reject);
                req.write(body);
                req.end();
            });

            if (b64) {
                const filepath = gallery.save(b64, { prefix: 'grok-imagine', ext: 'png' });
                console.log(`\n[IMAGE MODE] ✓ Saved: ${filepath}`);
            } else if (imageUrl) {
                const { metaPath } = gallery.saveUrl(imageUrl, { prefix: 'grok-imagine', prompt });
                console.log(`\n[IMAGE MODE] ✓ URL saved: ${metaPath}`);
                console.log(`[IMAGE MODE] URL: ${imageUrl}`);
            } else {
                throw new Error('No image data in response');
            }
        } catch (err) {
            console.log(`[IMAGE MODE] Grok Imagine error: ${err.message} — falling back to DALL-E`);
            const openaiKey = this.config.openAiKey || process.env.OPENAI_API_KEY;
            if (openaiKey) {
                await this.generateWithDalle(prompt, size, openaiKey);
            } else {
                await this.generatePlaceholder(prompt, size);
            }
        }
    }

    async generateWithDalle(prompt, size, apiKey) {
        console.log('[IMAGE MODE] Provider: OpenAI DALL-E 3');

        try {
            const body = JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, response_format: 'url' });
            const imageUrl = await new Promise((resolve, reject) => {
                const parsed = new URL('https://api.openai.com/v1/images/generations');
                const req = https.request(
                    {
                        hostname: parsed.hostname,
                        port: 443,
                        path: parsed.pathname,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(body),
                            Authorization: `Bearer ${apiKey}`,
                        },
                    },
                    (res) => {
                        let data = '';
                        res.on('data', (c) => (data += c));
                        res.on('end', () => {
                            try {
                                const resp = JSON.parse(data);
                                resolve(resp.data?.[0]?.url);
                            } catch { reject(new Error('Parse error')); }
                        });
                    },
                );
                req.on('error', reject);
                req.write(body);
                req.end();
            });

            if (imageUrl) {
                const { metaPath } = gallery.saveUrl(imageUrl, { prefix: 'dalle3', prompt });
                console.log(`\n[IMAGE MODE] ✓ URL: ${imageUrl}`);
                console.log(`[IMAGE MODE] Metadata: ${metaPath}`);
            } else {
                throw new Error('No URL returned');
            }
        } catch (err) {
            console.log(`[IMAGE MODE] DALL-E error: ${err.message}`);
            await this.generatePlaceholder(prompt, size);
        }
    }

    async generatePlaceholder(prompt, size) {
        // Writes a JSON placeholder so the gallery has a record even without an API key
        const record = {
            prompt,
            size,
            model: 'placeholder',
            note: 'Set XAI_API_KEY or OPENAI_API_KEY to generate real images',
            generatedAt: new Date().toISOString(),
        };
        const filepath = gallery.save(
            Buffer.from(JSON.stringify(record, null, 2)),
            { prefix: 'clawd-image-placeholder', ext: 'json' },
        );

        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║  IMAGE MODE — No API key configured                    ║');
        console.log('╠════════════════════════════════════════════════════════╣');
        console.log(`║  Prompt: ${prompt.substring(0, 46).padEnd(46)}  ║`);
        console.log(`║  Size:   ${size.padEnd(46)}  ║`);
        console.log('╠════════════════════════════════════════════════════════╣');
        console.log('║  Set XAI_API_KEY=<key>   for Grok Imagine              ║');
        console.log('║  Set OPENAI_API_KEY=<key> for DALL-E 3                 ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log(`\n[IMAGE MODE] Placeholder saved: ${filepath}`);
        console.log(`[IMAGE MODE] Gallery: ${gallery.dir}`);
    }
}
