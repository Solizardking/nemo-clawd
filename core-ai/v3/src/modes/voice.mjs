/**
 * Open Clawd v3 — VOICE MODE
 * Text-to-speech via xAI voice API.
 * Falls back to system TTS (macOS `say`, Linux `espeak`) if XAI_API_KEY is not set.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import os from 'os';

export class VoiceMode {
    constructor(config = {}) {
        this.config = config;
    }

    async run(args = []) {
        const text = args.filter((a) => !a.startsWith('--')).join(' ');

        if (!text.trim()) {
            console.error('[VOICE MODE] No text given. Usage: clawd voice "Hello from Clawd"');
            return;
        }

        const xaiKey = this.config.xaiApiKey || process.env.XAI_API_KEY;

        console.log(`\n[VOICE MODE] Text: "${text}"`);

        if (xaiKey) {
            await this.synthesizeXai(text, xaiKey);
        } else {
            await this.synthesizeSystem(text);
        }
    }

    async synthesizeXai(text, apiKey) {
        const model = process.env.XAI_VOICE_MODEL || 'grok-voice-latest';
        const voice = this.config.voice || process.env.XAI_TTS_VOICE || 'eve';
        const language = process.env.XAI_TTS_LANGUAGE || 'en';

        console.log(`[VOICE MODE] xAI TTS | model: ${model} | voice: ${voice}`);

        try {
            const body = JSON.stringify({ model, input: text, voice, language, response_format: 'mp3' });
            const audioData = await new Promise((resolve, reject) => {
                const parsed = new URL('https://api.x.ai/v1/audio/speech');
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
                        const chunks = [];
                        res.on('data', (c) => chunks.push(c));
                        res.on('end', () => resolve(Buffer.concat(chunks)));
                    },
                );
                req.on('error', reject);
                req.write(body);
                req.end();
            });

            const tmpFile = path.join(os.tmpdir(), `clawd-voice-${Date.now()}.mp3`);
            fs.writeFileSync(tmpFile, audioData);
            console.log(`[VOICE MODE] ✓ Audio: ${tmpFile}`);

            // Play if possible
            this.playAudio(tmpFile);
        } catch (err) {
            console.log(`[VOICE MODE] xAI TTS error: ${err.message} — falling back to system TTS`);
            await this.synthesizeSystem(text);
        }
    }

    async synthesizeSystem(text) {
        const platform = process.platform;
        console.log('[VOICE MODE] System TTS (local)');

        try {
            if (platform === 'darwin') {
                execSync(`say "${text.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
                console.log('[VOICE MODE] ✓ Spoken via macOS say');
            } else if (platform === 'linux') {
                execSync(`espeak "${text.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
                console.log('[VOICE MODE] ✓ Spoken via espeak');
            } else {
                console.log('[VOICE MODE] System TTS not available on this platform.');
                console.log('[VOICE MODE] Set XAI_API_KEY to use Grok voice synthesis.');
            }
        } catch {
            console.log('[VOICE MODE] System TTS failed. Set XAI_API_KEY for cloud synthesis.');
        }
    }

    playAudio(filepath) {
        const platform = process.platform;
        try {
            if (platform === 'darwin') execSync(`afplay "${filepath}"`, { stdio: 'ignore' });
            else if (platform === 'linux') execSync(`mpg123 "${filepath}" 2>/dev/null || play "${filepath}" 2>/dev/null`, { stdio: 'ignore', shell: true });
        } catch {
            console.log(`[VOICE MODE] Auto-play unavailable. Open: ${filepath}`);
        }
    }
}
