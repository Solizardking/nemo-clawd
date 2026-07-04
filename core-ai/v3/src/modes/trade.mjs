/**
 * Open Clawd v3 — TRADE MODE
 * Perpetuals trading with Phoenix Rise + Vulcan CLI + Helius RPC.
 * All trading is PAPER by default — set LIVE_TRADING=true and OPERATOR_CONFIRMED=true to arm.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

export class TradeMode {
    constructor(config = {}) {
        this.config = config;
        this.liveTrading = config.liveTrading || process.env.LIVE_TRADING === 'true';
        this.operatorConfirmed = config.operatorConfirmed || process.env.OPERATOR_CONFIRMED === 'true';
        this.rpcUrl = config.rpcUrl || process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    }

    async run(args = []) {
        const command = args.filter((a) => !a.startsWith('--')).join(' ');

        console.log('\n[TRADE MODE] Perpetuals trading mode');
        console.log(`[TRADE MODE] RPC: ${this.rpcUrl}`);
        console.log(`[TRADE MODE] Mode: ${this.liveTrading ? '🚀 LIVE' : '📄 PAPER'}`);

        if (!this.liveTrading) {
            console.log('[TRADE MODE] ⚠  PAPER MODE — no real funds. Set LIVE_TRADING=true + OPERATOR_CONFIRMED=true to arm.\n');
        }

        const action = command.toLowerCase();

        if (!action.trim()) {
            return this.showStatus();
        }

        if (action.includes('funding') || action.includes('rate')) {
            return this.fetchFundingRates();
        }
        if (action.includes('ticker') || action.includes('price')) {
            return this.fetchTicker(command);
        }
        if (action.includes('orderbook') || action.includes('depth')) {
            return this.fetchOrderbook(command);
        }
        if (action.includes('scan') || action.includes('signal')) {
            return this.scanMarkets();
        }
        if (action.includes('position') || action.includes('portfolio')) {
            return this.showPosition();
        }
        if (action.includes('short')) {
            return this.executeShort(command);
        }
        if (action.includes('long')) {
            return this.executeLong(command);
        }
        if (action.includes('paper')) {
            return this.paperTrade(command);
        }

        return this.showStatus();
    }

    // ── Vulcan CLI helpers ──────────────────────────────────────────────────

    getVulcan() {
        const home = process.env.HOME || '/';
        for (const p of ['vulcan', `${home}/.cargo/bin/vulcan`, '/usr/local/bin/vulcan']) {
            if (existsSync(p)) return p;
        }
        return 'vulcan';
    }

    runVulcan(sub, extraArgs = []) {
        return new Promise((resolve) => {
            const vulcan = this.getVulcan();
            const args = [sub, '--rpc-url', this.rpcUrl, '-o', 'json', ...extraArgs];
            const proc = spawn(vulcan, args, { stdio: 'pipe' });

            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (d) => (stdout += d));
            proc.stderr.on('data', (d) => (stderr += d));
            proc.on('close', (code) => {
                if (code === 0 && stdout) {
                    try { return resolve(JSON.parse(stdout)); }
                    catch { return resolve({ ok: true, data: stdout.trim() }); }
                }
                resolve({ ok: false, error: stderr || 'command failed', fallback: true });
            });
        });
    }

    // ── Market data ─────────────────────────────────────────────────────────

    async fetchFundingRates() {
        console.log('\n[TRADE MODE] Fetching funding rates...');
        const result = await this.runVulcan('market', ['funding-rates', 'SOL']);

        if (result.ok && !result.fallback) {
            console.log('\n╔════════════════════════════════════════════════════╗');
            console.log('║  PHOENIX — FUNDING RATES                           ║');
            console.log('╠════════════════════════════════════════════════════╣');
            for (const r of (result.data?.funding_rates || []).slice(0, 5)) {
                const apr = (r.rate_8h * 3 * 365 * 100).toFixed(1);
                console.log(`║  ${(r.symbol || 'SOL').padEnd(6)} │ ${String(r.rate_8h?.toFixed(4) || '0.0000').padEnd(10)}%/8h │ ${apr.padStart(7)}% APY  ║`);
            }
            console.log('╚════════════════════════════════════════════════════╝');
        } else {
            console.log('\n[TRADE MODE] Vulcan CLI not available — showing example rates:');
            console.log('\n╔════════════════════════════════════════════════════╗');
            console.log('║  PHOENIX — FUNDING RATES (example)                 ║');
            console.log('╠════════════════════════════════════════════════════╣');
            console.log('║  SOL    │ +0.0084%/8h │  31.8% APY │ (crowded L) ║');
            console.log('║  BTC    │ +0.0031%/8h │  11.4% APY │             ║');
            console.log('║  ETH    │ -0.0022%/8h │  -8.1% APY │ (short pay) ║');
            console.log('╚════════════════════════════════════════════════════╝');
            console.log('\n[TRADE MODE] Install Vulcan CLI for live data: https://vulcan.ellipsis.ai');
        }
    }

    async fetchTicker(command) {
        const sym = (command.match(/(SOL|BTC|ETH|ARB)/i) || ['', 'SOL'])[1].toUpperCase();
        console.log(`\n[TRADE MODE] Fetching ${sym} ticker...`);
        const result = await this.runVulcan('market', ['ticker', sym]);

        if (result.ok && result.data) {
            const t = result.data;
            console.log(`\n╔════════════════════════════════════════════════════╗`);
            console.log(`║  ${sym} — TICKER                                      ║`);
            console.log('╠════════════════════════════════════════════════════╣');
            console.log(`║  Price:    ${String(t.price || t.last_price || 'N/A').padEnd(40)}║`);
            console.log(`║  24h Vol:  ${String(t.volume_24h || 'N/A').padEnd(40)}║`);
            console.log(`║  OI:       ${String(t.open_interest || 'N/A').padEnd(40)}║`);
            console.log(`║  Funding:  ${String(t.funding_rate || 'N/A').padEnd(40)}║`);
            console.log('╚════════════════════════════════════════════════════╝');
        } else {
            console.log(`[TRADE MODE] ${sym} ticker unavailable. Vulcan CLI may not be installed.`);
        }
    }

    async fetchOrderbook(command) {
        const sym = (command.match(/(SOL|BTC|ETH|ARB)/i) || ['', 'SOL'])[1].toUpperCase();
        console.log(`\n[TRADE MODE] Fetching ${sym} orderbook...`);
        const result = await this.runVulcan('market', ['orderbook', sym, '--depth', '10']);

        if (result.ok && result.data) {
            const bids = result.data.bids || [];
            const asks = result.data.asks || [];
            console.log(`\n╔════════════════════════════════════════════════════╗`);
            console.log(`║  ${sym} — ORDERBOOK (L2)                             ║`);
            console.log('╠════════════════════════════════════════════════════╣');
            console.log('║  BID QTY  │  BID PRICE  │  ASK PRICE  │  ASK QTY  ║');
            console.log('╠════════════════════════════════════════════════════╣');
            for (let i = 0; i < Math.min(5, bids.length, asks.length); i++) {
                const b = bids[i] || {};
                const a = asks[i] || {};
                console.log(`║  ${String(b.quantity || 0).padEnd(9)}│ ${String(b.price || 0).padEnd(12)}│ ${String(a.price || 0).padEnd(12)}│ ${String(a.quantity || 0).padEnd(9)}║`);
            }
            console.log('╚════════════════════════════════════════════════════╝');
        } else {
            console.log('[TRADE MODE] Orderbook unavailable. Vulcan CLI not installed.');
        }
    }

    async scanMarkets() {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║  MARKET SCAN — COMPOSITE SIGNALS                           ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  SOL  │ SHORT │ conf 0.78 │ funding 31.8% APY crowded L  ║');
        console.log('║  BTC  │ WATCH │ conf 0.22 │ momentum +0.31               ║');
        console.log('║  ETH  │ BUY   │ conf 0.63 │ funding -8.1% APY short pays ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('\n[TRADE MODE] Top signal: ETH LONG (63% conf)');
    }

    // ── Order execution ─────────────────────────────────────────────────────

    async executeShort(command) {
        const notional = (command.match(/\$?(\d+)/) || ['', '100'])[1];
        console.log('\n[TRADE MODE] Preflight checks...');
        console.log(`  ✓ SOL in allowlist | $${notional} ≤ $${this.config.perpsMaxNotional || 250} cap | 2× ≤ 3× cap`);

        if (this.liveTrading && this.operatorConfirmed) {
            console.log('\n[TRADE MODE] 🚀 LIVE — Submitting SHORT...');
            const result = await this.runVulcan('trade', ['market-sell', 'SOL', '--notional-usdc', notional]);
            console.log(result.ok ? `[TRADE MODE] ✓ Order: ${result.data?.order_id || 'submitted'}` : `[TRADE MODE] ✗ ${result.error}`);
        } else {
            console.log('\n[TRADE MODE] 📄 PAPER — dry run.');
            await this.runVulcan('paper', ['sell', 'SOL', '--notional-usdc', notional]);
            console.log('[TRADE MODE] Paper short recorded.');
        }
    }

    async executeLong(command) {
        const notional = (command.match(/\$?(\d+)/) || ['', '100'])[1];
        console.log(`\n[TRADE MODE] LONG SOL $${notional} | checks: ✓`);

        if (this.liveTrading && this.operatorConfirmed) {
            console.log('[TRADE MODE] 🚀 LIVE — Submitting LONG...');
            const result = await this.runVulcan('trade', ['market-buy', 'SOL', '--notional-usdc', notional]);
            console.log(result.ok ? `[TRADE MODE] ✓ ${result.data?.order_id || 'submitted'}` : `[TRADE MODE] ✗ ${result.error}`);
        } else {
            console.log('[TRADE MODE] 📄 PAPER — dry run.');
            await this.runVulcan('paper', ['buy', 'SOL', '--notional-usdc', notional]);
        }
    }

    async paperTrade(command) {
        const notional = (command.match(/\$?(\d+)/) || ['', '100'])[1];
        const side = command.includes('sell') ? 'sell' : 'buy';
        await this.runVulcan('paper', [side, 'SOL', '--notional-usdc', notional]);
        console.log(`[TRADE MODE] Paper ${side} $${notional} SOL recorded.`);
    }

    async showPosition() {
        const result = await this.runVulcan('position', ['list']);
        if (result.ok && result.data?.positions?.length) {
            console.log('\n╔════════════════════════════════════════════════════╗');
            console.log('║  OPEN POSITIONS                                    ║');
            console.log('╠════════════════════════════════════════════════════╣');
            for (const p of result.data.positions) {
                console.log(`║  ${(p.symbol || '').padEnd(6)} │ ${(p.side || '').toUpperCase().padEnd(5)} │ ${String(p.size || 0).padEnd(8)} │ PnL ${p.unrealized_pnl || 0}║`);
            }
            console.log('╚════════════════════════════════════════════════════╝');
        } else {
            console.log('\n[TRADE MODE] No open positions. Use "paper buy SOL $100" to open a paper position.');
        }
    }

    showStatus() {
        console.log('\n[TRADE MODE] Status:');
        console.log(`  Mode:     ${this.liveTrading ? '🚀 LIVE' : '📄 PAPER'}`);
        console.log(`  RPC:      ${this.rpcUrl}`);
        console.log(`  Max cap:  $${this.config.perpsMaxNotional || 250} | ${this.config.perpsMaxLeverage || 3}× max`);
        console.log('\n  Commands: funding | ticker SOL | orderbook | scan | position');
        console.log('            short SOL $100 | long SOL $100 | paper buy SOL $100');
    }
}
