/**
 * Local Gallery Storage — replaces Replit ObjectStore for image/asset persistence.
 *
 * The original clawd-code image mode tried to use @replit/object-storage and emitted:
 *   [ObjectStore] Replit object storage disabled; using in-memory gallery fallback
 *
 * This module provides a proper local-filesystem gallery that works anywhere:
 *   ~/.clawd/gallery/      — persistent cross-project gallery
 *   ./outputs/gallery/     — project-local gallery (used when cwd has package.json)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const GLOBAL_GALLERY_DIR = path.join(os.homedir(), '.clawd', 'gallery');
const LOCAL_GALLERY_DIR = path.join(process.cwd(), 'outputs', 'gallery');

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function isProjectLocal() {
    return fs.existsSync(path.join(process.cwd(), 'package.json'));
}

export class LocalGallery {
    constructor(options = {}) {
        this.baseDir = options.dir || (isProjectLocal() ? LOCAL_GALLERY_DIR : GLOBAL_GALLERY_DIR);
        ensureDir(this.baseDir);
    }

    /**
     * Save a Buffer or base64 string as an image file.
     * Returns the saved file path.
     */
    save(data, options = {}) {
        const ext = options.ext || 'png';
        const prefix = options.prefix || 'clawd';
        const timestamp = Date.now();
        const id = crypto.randomBytes(4).toString('hex');
        const filename = `${prefix}-${timestamp}-${id}.${ext}`;
        const filepath = path.join(this.baseDir, filename);

        if (typeof data === 'string') {
            const buf = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
            fs.writeFileSync(filepath, buf);
        } else {
            fs.writeFileSync(filepath, data);
        }

        return filepath;
    }

    /**
     * Save a URL reference (no download) — logs the URL and records a metadata file.
     */
    saveUrl(url, options = {}) {
        const prefix = options.prefix || 'clawd';
        const timestamp = Date.now();
        const id = crypto.randomBytes(4).toString('hex');
        const metaFilename = `${prefix}-${timestamp}-${id}.url.json`;
        const metaPath = path.join(this.baseDir, metaFilename);
        const meta = { url, savedAt: new Date().toISOString(), ...options };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        return { metaPath, url };
    }

    /**
     * List all gallery items (most recent first).
     */
    list(limit = 50) {
        try {
            const entries = fs.readdirSync(this.baseDir)
                .map(name => {
                    const full = path.join(this.baseDir, name);
                    const stat = fs.statSync(full);
                    return { name, path: full, mtime: stat.mtime, size: stat.size };
                })
                .sort((a, b) => b.mtime - a.mtime)
                .slice(0, limit);
            return entries;
        } catch {
            return [];
        }
    }

    /**
     * Read a gallery item by filename.
     */
    read(filename) {
        const filepath = path.join(this.baseDir, filename);
        if (!fs.existsSync(filepath)) return null;
        return fs.readFileSync(filepath);
    }

    get dir() {
        return this.baseDir;
    }

    printStatus() {
        const items = this.list();
        console.log(`[Gallery] Storage: ${this.baseDir}`);
        console.log(`[Gallery] Items: ${items.length}`);
        if (items.length > 0) {
            const total = items.reduce((sum, i) => sum + i.size, 0);
            console.log(`[Gallery] Total size: ${(total / 1024).toFixed(1)} KB`);
        }
    }
}

export const gallery = new LocalGallery();
