#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Nemo Clawd Fly.io wrapper — admin dashboard + reverse proxy to Nemo Clawd gateway.
// Protected by ADMIN_KEY env var (default: bbjp732!)

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");

// ── Config ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000", 10);
const GATEWAY_PORT = 18789;
const DATA_DIR = process.env.DATA_DIR || "/data";
const CONFIG_PATH = path.join(DATA_DIR, "nemoclawd.json");
const SETUP_PASSWORD = process.env.SETUP_PASSWORD || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "bbjp732!";
const GATEWAY_TOKEN =
  process.env.NEMOCLAWD_GATEWAY_TOKEN ||
  crypto.randomBytes(24).toString("hex");

let gatewayProc = null;

// ── Helpers ────────────────────────────────────────────────────────
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o600);
}

function checkAdminKey(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // Check query param, header, or cookie
  if (url.searchParams.get("admin_key") === ADMIN_KEY) return true;
  if (req.headers["x-admin-key"] === ADMIN_KEY) return true;
  const cookie = req.headers.cookie || "";
  if (cookie.includes(`admin_key=${ADMIN_KEY}`)) return true;
  return false;
}

function checkBasicAuth(req) {
  if (!SETUP_PASSWORD) return true;
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const [, pass] = decoded.split(":");
  return pass === SETUP_PASSWORD;
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function htmlPage(title, body, extra = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:#0a0a0f;color:#e0e0e0;min-height:100vh;display:flex;flex-direction:column;align-items:center}
.container{max-width:1000px;width:100%;padding:1.5rem}
h1{font-size:1.5rem;margin-bottom:0.5rem;color:#7c3aed}
h2{font-size:1.15rem;margin:1rem 0 0.5rem;color:#a78bfa}
p{margin:0.5rem 0;line-height:1.6}
a{color:#7c3aed}
.card{background:#16161e;border:1px solid #2a2a3a;border-radius:10px;padding:1.25rem;margin:0.75rem 0}
label{display:block;margin:0.5rem 0 0.2rem;font-weight:500;font-size:0.85rem}
input,select,textarea{width:100%;padding:0.5rem 0.75rem;background:#0e0e16;border:1px solid #333;
  border-radius:6px;color:#e0e0e0;font-size:0.9rem;outline:none;transition:border-color 0.2s}
input:focus,select:focus,textarea:focus{border-color:#7c3aed}
textarea{min-height:100px;font-family:monospace;font-size:0.8rem}
button{background:#7c3aed;color:#fff;border:none;padding:0.55rem 1.25rem;border-radius:6px;
  cursor:pointer;font-size:0.9rem;margin-top:0.75rem;transition:background 0.2s}
button:hover{background:#6d28d9}
button.secondary{background:#2a2a3a}
button.secondary:hover{background:#3a3a4a}
button.danger{background:#dc2626}
button.danger:hover{background:#b91c1c}
.status{display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.8rem;font-weight:500}
.status.ok{background:#065f46;color:#6ee7b7}
.status.err{background:#7f1d1d;color:#fca5a5}
pre.log{background:#0e0e16;padding:0.75rem;border-radius:6px;overflow-x:auto;font-size:0.75rem;max-height:250px;overflow-y:auto;border:1px solid #222}
code{background:#0e0e16;padding:2px 6px;border-radius:4px;font-size:0.85rem}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem}
@media(max-width:600px){.grid{grid-template-columns:1fr}}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:500}
.badge-purple{background:#3b0764;color:#c084fc}
.badge-green{background:#064e3b;color:#6ee7b7}
.badge-blue{background:#1e3a5f;color:#93c5fd}
.mt-1{margin-top:0.5rem}
.mb-1{margin-bottom:0.5rem}
.flex{display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap}
.justify-between{justify-content:space-between}
.grow{flex:1}
.text-center{text-align:center}
.text-muted{color:#888}
.text-sm{font-size:0.85rem}
${extra}
</style>
</head>
<body>
<div class="container">${body}</div>
</body></html>`;
}

function renderLoginPage(msg) {
  return htmlPage("Nemo Clawd — Login", `
<div style="max-width:400px;margin:4rem auto">
  <div class="text-center mb-1">
    <h1 style="font-size:2rem">⚡ Nemo Clawd</h1>
    <p class="text-muted">Solana x AI Agentic Trading Engine</p>
  </div>
  <div class="card" style="margin-top:1.5rem">
    <form method="GET" action="/">
      <label for="key">Admin Key</label>
      <input type="password" name="admin_key" id="key" placeholder="Enter your admin key" autofocus>
      <button type="submit" style="width:100%">Unlock Dashboard</button>
    </form>
    ${msg ? `<p class="text-muted text-sm mt-1 text-center">${msg}</p>` : ""}
  </div>
  <p class="text-muted text-sm text-center mt-1">Protected access — authorized users only</p>
</div>
`);
}

function renderDashboard() {
  const cfg = loadConfig();
  const running = isGatewayRunning();
  const statusClass = running ? "ok" : "err";
  const statusText = running ? "Running" : "Stopped";
  const providerLabel = {
    anthropic: "Anthropic", openai: "OpenAI", nvidia: "NVIDIA",
    gemini: "Google Gemini", openrouter: "OpenRouter", moonshot: "Moonshot AI", minimax: "MiniMax"
  };
  const connectedChannels = [];
  if (cfg.telegramToken) connectedChannels.push("Telegram");
  if (cfg.discordToken) connectedChannels.push("Discord");
  if (cfg.slackBotToken) connectedChannels.push("Slack");

  return htmlPage("Nemo Clawd — Dashboard", `
<div class="flex justify-between mb-1">
  <div>
    <h1 style="margin:0">⚡ Nemo Clawd</h1>
    <p class="text-muted text-sm">Solana x AI Agentic Trading Engine</p>
  </div>
  <div class="flex">
    <span class="status ${statusClass}">${statusText}</span>
  </div>
</div>

<div class="grid">
  <div class="card">
    <h2>Gateway</h2>
    <p class="text-sm">Token: <code style="font-size:0.7rem">${GATEWAY_TOKEN.slice(0,12)}...</code></p>
    <p class="text-sm">WebSocket: <code style="font-size:0.7rem">wss://${process.env.FLY_APP_NAME || "app"}.fly.dev</code></p>
    <p class="text-sm">LLM: ${providerLabel[cfg.provider] || cfg.provider || "Not configured"}</p>
    <div class="flex mt-1">
      <span class="badge badge-purple">${cfg.provider || "No provider"}</span>
      ${connectedChannels.map(c => `<span class="badge badge-green">${c}</span>`).join("")}
      ${cfg.solanaRpcUrl ? '<span class="badge badge-blue">Solana</span>' : ""}
    </div>
  </div>
  <div class="card">
    <h2>Quick Actions</h2>
    <div class="flex">
      <button class="secondary" onclick="fetch('/api/restart',{method:'POST'}).then(()=>location.reload())" style="margin:0">Restart</button>
      <button class="danger" onclick="if(confirm('Reset all configuration?'))fetch('/api/reset',{method:'POST'}).then(()=>location.reload())" style="margin:0">Reset</button>
    </div>
    <p class="text-sm mt-1"><a href="/setup">Open Setup Wizard →</a></p>
  </div>
</div>

<div class="card">
  <h2>Chat with Nemo Clawd</h2>
  <p class="text-sm text-muted">Send messages to your Nemo Clawd agent and get AI-powered Solana trading responses.</p>
  <div id="chat-box" style="background:#0e0e16;border:1px solid #222;border-radius:8px;padding:1rem;height:350px;overflow-y:auto;margin:0.5rem 0;display:flex;flex-direction:column;gap:0.5rem">
    <div style="text-align:center;color:#666;font-size:0.85rem;margin-top:7rem">
      <p>Send a message to start chatting</p>
      <p class="text-sm">e.g. "check my SOL balance" or "show trending tokens"</p>
    </div>
  </div>
  <div class="flex" style="gap:0">
    <input type="text" id="chat-input" placeholder="Type a message..." style="border-radius:6px 0 0 6px;margin:0;flex:1"
      onkeydown="if(event.key==='Enter')sendChat()">
    <button onclick="sendChat()" style="border-radius:0 6px 6px 0;margin:0;padding:0.55rem 1rem">Send</button>
  </div>
</div>

<div class="card">
  <h2>Gateway Logs</h2>
  <pre class="log" id="logs">${escapeHtml(getGatewayLogs(60))}</pre>
  <button class="secondary" onclick="fetch('/api/logs').then(r=>r.text()).then(t=>document.getElementById('logs').textContent=t)" style="margin:0">Refresh</button>
</div>

<div class="card">
  <h2>Configuration</h2>
  <form id="config-form" onsubmit="saveConfig(event)">
    <div class="grid">
      <div>
        <label>Provider</label>
        <select name="provider">
          <option value="anthropic" ${cfg.provider==="anthropic"?"selected":""}>Anthropic</option>
          <option value="openai" ${cfg.provider==="openai"?"selected":""}>OpenAI</option>
          <option value="nvidia" ${cfg.provider==="nvidia"?"selected":""}>NVIDIA</option>
          <option value="gemini" ${cfg.provider==="gemini"?"selected":""}>Google Gemini</option>
          <option value="openrouter" ${cfg.provider==="openrouter"?"selected":""}>OpenRouter</option>
          <option value="moonshot" ${cfg.provider==="moonshot"?"selected":""}>Moonshot AI</option>
          <option value="minimax" ${cfg.provider==="minimax"?"selected":""}>MiniMax</option>
        </select>
      </div>
      <div>
        <label>API Key</label>
        <input type="password" name="apiKey" value="${cfg.apiKey||""}" placeholder="sk-...">
      </div>
    </div>
    <div class="grid">
      <div>
        <label>Solana RPC URL</label>
        <input type="text" name="solanaRpcUrl" value="${cfg.solanaRpcUrl||""}" placeholder="https://rpc.solanatracker.io/public">
      </div>
      <div>
        <label>Helius API Key</label>
        <input type="password" name="heliusApiKey" value="${cfg.heliusApiKey||""}" placeholder="helius-key">
      </div>
    </div>
    <div class="grid">
      <div>
        <label>Telegram Token</label>
        <input type="password" name="telegramToken" value="${cfg.telegramToken||""}">
      </div>
      <div>
        <label>Discord Token</label>
        <input type="password" name="discordToken" value="${cfg.discordToken||""}">
      </div>
    </div>
    <button type="submit">Save & Restart</button>
  </form>
</div>

<script>
async function sendChat() {
  const input = document.getElementById('chat-input');
  const box = document.getElementById('chat-box');
  const msg = input.value.trim();
  if (!msg) return;

  // Clear placeholder
  const placeholder = box.querySelector('div[style*="text-align:center"]');
  if (placeholder) placeholder.remove();

  // Add user message
  const userBubble = document.createElement('div');
  userBubble.style.cssText = 'background:#1e1b4b;border:1px solid #312e81;border-radius:12px 12px 4px 12px;padding:0.6rem 0.9rem;align-self:flex-end;max-width:80%;font-size:0.85rem';
  userBubble.textContent = msg;
  box.appendChild(userBubble);
  box.scrollTop = box.scrollHeight;

  input.value = '';
  input.disabled = true;

  // Add loading indicator
  const loadBubble = document.createElement('div');
  loadBubble.style.cssText = 'background:#1a1a2e;border:1px solid #2a2a3a;border-radius:12px 12px 12px 4px;padding:0.6rem 0.9rem;align-self:flex-start;max-width:80%;font-size:0.85rem';
  loadBubble.innerHTML = '<span style="opacity:0.5">Thinking...</span>';
  box.appendChild(loadBubble);
  box.scrollTop = box.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({message: msg, admin_key: '${ADMIN_KEY}'})
    });
    const data = await res.json();
    loadBubble.remove();

    // Add AI response
    const aiBubble = document.createElement('div');
    aiBubble.style.cssText = 'background:#1a1a2e;border:1px solid #2a2a3a;border-radius:12px 12px 12px 4px;padding:0.6rem 0.9rem;align-self:flex-start;max-width:80%;font-size:0.85rem;white-space:pre-wrap';
    aiBubble.textContent = data.response || data.error || '(no response)';
    box.appendChild(aiBubble);
  } catch(e) {
    loadBubble.remove();
    const errBubble = document.createElement('div');
    errBubble.style.cssText = 'background:#7f1d1d;border:1px solid #991b1b;border-radius:12px 12px 12px 4px;padding:0.6rem 0.9rem;align-self:flex-start;max-width:80%;font-size:0.85rem';
    errBubble.textContent = 'Error: ' + e.message;
    box.appendChild(errBubble);
  }

  input.disabled = false;
  input.focus();
  box.scrollTop = box.scrollHeight;
}

async function saveConfig(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({...data, admin_key: '${ADMIN_KEY}'})
    });
    if (res.ok) {
      // Also restart
      await fetch('/api/restart', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({admin_key: '${ADMIN_KEY}'})});
      location.reload();
    }
  } catch(e) {
    alert('Save failed: ' + e.message);
  }
}
</script>
`);
}

function escapeHtml(s) {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

// ── Chat proxy ─────────────────────────────────────────────────────
async function proxyChat(message) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ message });
    const opts = {
      hostname: "127.0.0.1",
      port: GATEWAY_PORT,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Authorization": `Bearer ${GATEWAY_TOKEN}`,
      },
    };

    const proxyReq = http.request(opts, (proxyRes) => {
      let data = "";
      proxyRes.on("data", (chunk) => (data += chunk));
      proxyRes.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ error: "Invalid response from gateway" }); }
      });
    });

    proxyReq.on("error", () => {
      resolve({ error: "Gateway unavailable. Check /setup for status." });
    });

    proxyReq.write(body);
    proxyReq.end();
  });
}

// ── Parse form body ────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        if (req.headers["content-type"]?.includes("json")) {
          resolve(JSON.parse(body));
        } else {
          const params = new URLSearchParams(body);
          const obj = {};
          for (const [k, v] of params) obj[k] = v;
          resolve(obj);
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}

// ── Gateway management ─────────────────────────────────────────────
function startGateway() {
  if (gatewayProc && !gatewayProc.killed) {
    try { gatewayProc.kill(); } catch {}
  }

  const cfg = loadConfig();
  const env = { ...process.env, HOME: DATA_DIR };

  if (cfg.provider && cfg.apiKey) {
    const providerEnvMap = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GOOGLE_API_KEY",
      nvidia: "NVIDIA_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      moonshot: "MOONSHOT_API_KEY",
      minimax: "MINIMAX_API_KEY",
    };
    const envKey = providerEnvMap[cfg.provider];
    if (envKey) env[envKey] = cfg.apiKey;
  }

  if (cfg.discordToken) env.DISCORD_TOKEN = cfg.discordToken;
  if (cfg.telegramToken) env.TELEGRAM_BOT_TOKEN = cfg.telegramToken;
  if (cfg.slackBotToken) env.SLACK_BOT_TOKEN = cfg.slackBotToken;
  if (cfg.slackAppToken) env.SLACK_APP_TOKEN = cfg.slackAppToken;
  if (cfg.solanaRpcUrl) env.SOLANA_RPC_URL = cfg.solanaRpcUrl;
  if (cfg.privyAppId) env.PRIVY_APP_ID = cfg.privyAppId;
  if (cfg.privyAppSecret) env.PRIVY_APP_SECRET = cfg.privyAppSecret;
  if (cfg.heliusApiKey) env.HELIUS_API_KEY = cfg.heliusApiKey;

  env.NEMOCLAWD_GATEWAY_TOKEN = GATEWAY_TOKEN;
  env.PUBLIC_PORT = String(GATEWAY_PORT);
  env.CHAT_UI_URL = `http://127.0.0.1:${GATEWAY_PORT}`;

  const logFile = fs.openSync(path.join(DATA_DIR, "gateway.log"), "a");
  gatewayProc = spawn("/usr/local/bin/nemoclawd-start", [], {
    env,
    stdio: ["ignore", logFile, logFile],
    detached: true,
  });
  gatewayProc.unref();
  console.log(`[wrapper] Gateway started (pid ${gatewayProc.pid})`);
}

function isGatewayRunning() {
  if (!gatewayProc || gatewayProc.killed) return false;
  try {
    process.kill(gatewayProc.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getGatewayLogs(lines = 100) {
  try {
    const logPath = path.join(DATA_DIR, "gateway.log");
    const content = fs.readFileSync(logPath, "utf-8");
    return content.split("\n").slice(-lines).join("\n");
  } catch {
    return "(no logs yet)";
  }
}

// ── HTTP proxy to gateway ──────────────────────────────────────────
function proxyToGateway(req, res) {
  const opts = {
    hostname: "127.0.0.1",
    port: GATEWAY_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${GATEWAY_PORT}` },
  };

  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Gateway unavailable — check /setup for status.");
  });

  req.pipe(proxyReq, { end: true });
}

// ── WebSocket upgrade proxy ────────────────────────────────────────
function proxyUpgrade(req, socket, head) {
  const net = require("net");
  const proxySocket = net.connect(GATEWAY_PORT, "127.0.0.1", () => {
    const reqLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
    const headers = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    proxySocket.write(reqLine + headers + "\r\n\r\n");
    if (head.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxySocket.on("error", () => socket.destroy());
  socket.on("error", () => proxySocket.destroy());
}

// ── Main server ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // ── Admin key check (except health check) ──────────────────────────
  const publicPaths = ["/healthz", "/favicon.ico"];
  const isPublic = publicPaths.some(p => url.pathname === p);

  if (!isPublic && !checkAdminKey(req)) {
    // If it's a page request, show login; otherwise return 401
    if (req.headers.accept?.includes("text/html")) {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Set-Cookie": "admin_key=;Max-Age=0;Path=/;HttpOnly",
      });
      return res.end(renderLoginPage("Please enter your admin key to continue."));
    }
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Unauthorized — provide ?admin_key= or X-Admin-Key header" }));
  }

  // Health check
  if (url.pathname === "/healthz") {
    return json(res, {
      status: "ok",
      gateway: isGatewayRunning() ? "running" : "stopped",
      uptime: process.uptime(),
    });
  }

  // ── Dashboard ──────────────────────────────────────────────────────
  if (url.pathname === "/" || url.pathname === "/dashboard") {
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Set-Cookie": `admin_key=${ADMIN_KEY};Max-Age=86400;Path=/;HttpOnly`,
    });
    return res.end(renderDashboard());
  }

  // ── API Routes ─────────────────────────────────────────────────────
  if (url.pathname === "/api/chat" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const result = await proxyChat(body.message || "");
      return json(res, result);
    } catch (e) {
      return json(res, { error: e.message }, 500);
    }
  }

  if (url.pathname === "/api/status" && req.method === "GET") {
    return json(res, {
      gateway: isGatewayRunning() ? "running" : "stopped",
      uptime: process.uptime(),
      config: loadConfig(),
      gatewayToken: GATEWAY_TOKEN.slice(0, 8) + "...",
    });
  }

  if (url.pathname === "/api/logs" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(getGatewayLogs(200));
  }

  if (url.pathname === "/api/restart" && req.method === "POST") {
    startGateway();
    return json(res, { status: "restarting" });
  }

  if (url.pathname === "/api/reset" && req.method === "POST") {
    try { fs.unlinkSync(CONFIG_PATH); } catch {}
    if (gatewayProc && !gatewayProc.killed) {
      try { gatewayProc.kill(); } catch {}
    }
    return json(res, { status: "reset" });
  }

  if (url.pathname === "/api/config" && req.method === "GET") {
    return json(res, loadConfig());
  }

  if (url.pathname === "/api/config" && req.method === "PUT") {
    try {
      const body = await parseBody(req);
      const cfg = {};
      const fields = [
        "provider", "apiKey", "solanaRpcUrl", "heliusApiKey",
        "privyAppId", "privyAppSecret",
        "telegramToken", "discordToken", "slackBotToken", "slackAppToken",
      ];
      for (const f of fields) {
        if (body[f] !== undefined) {
          if (body[f]) cfg[f] = body[f];
        }
      }
      saveConfig(cfg);
      return json(res, { status: "saved" });
    } catch (e) {
      return json(res, { error: e.message }, 400);
    }
  }

  // ── Setup routes (backward compat, requires basic auth + admin key) ─
  if (url.pathname.startsWith("/setup")) {
    if (!checkBasicAuth(req)) {
      res.writeHead(401, {
        "WWW-Authenticate": 'Basic realm="Nemo Clawd Setup"',
        "Content-Type": "text/plain",
      });
      return res.end("Unauthorized");
    }

    // Load the old setup wizard helpers
    function renderOldSetupPage() {
      const c = loadConfig();
      const r = isGatewayRunning();
      const sc = r ? "ok" : "err";
      const st = r ? "Running" : "Stopped";
      return htmlPage("Nemo Clawd Setup", `
<h1>Nemo Clawd Setup</h1>
<p>Configure your Nemo Clawd deployment on Fly.io. <a href="/">← Back to Dashboard</a></p>
<div class="card">
  <h2>Gateway Status</h2>
  <p>Status: <span class="status ${sc}">${st}</span></p>
  <p>Gateway token: <code>${GATEWAY_TOKEN.slice(0, 8)}...</code></p>
  <p>WebSocket URL: <code>wss://${process.env.FLY_APP_NAME || "your-app"}.fly.dev</code></p>
</div>
<form method="POST" action="/setup/save">
<div class="card">
  <h2>LLM Provider</h2>
  <div class="grid">
    <div>
      <label for="provider">Provider</label>
      <select name="provider" id="provider">
        <option value="anthropic" ${c.provider==="anthropic"?"selected":""}>Anthropic</option>
        <option value="openai" ${c.provider==="openai"?"selected":""}>OpenAI</option>
        <option value="nvidia" ${c.provider==="nvidia"?"selected":""}>NVIDIA</option>
        <option value="gemini" ${c.provider==="gemini"?"selected":""}>Google Gemini</option>
        <option value="openrouter" ${c.provider==="openrouter"?"selected":""}>OpenRouter</option>
        <option value="moonshot" ${c.provider==="moonshot"?"selected":""}>Moonshot AI</option>
        <option value="minimax" ${c.provider==="minimax"?"selected":""}>MiniMax</option>
      </select>
    </div>
    <div>
      <label for="apiKey">API Key</label>
      <input type="password" name="apiKey" id="apiKey" value="${c.apiKey||""}">
    </div>
  </div>
</div>
<div class="card">
  <h2>Solana Configuration</h2>
  <div class="grid">
    <div>
      <label for="solanaRpcUrl">Solana RPC URL</label>
      <input type="text" name="solanaRpcUrl" id="solanaRpcUrl" value="${c.solanaRpcUrl||""}">
    </div>
    <div>
      <label for="heliusApiKey">Helius API Key</label>
      <input type="password" name="heliusApiKey" id="heliusApiKey" value="${c.heliusApiKey||""}">
    </div>
  </div>
  <div class="grid">
    <div>
      <label for="privyAppId">Privy App ID</label>
      <input type="text" name="privyAppId" id="privyAppId" value="${c.privyAppId||""}">
    </div>
    <div>
      <label for="privyAppSecret">Privy App Secret</label>
      <input type="password" name="privyAppSecret" id="privyAppSecret" value="${c.privyAppSecret||""}">
    </div>
  </div>
</div>
<div class="card">
  <h2>Channel Connections</h2>
  <label for="telegramToken">Telegram Bot Token</label>
  <input type="password" name="telegramToken" id="telegramToken" value="${c.telegramToken||""}">
  <label for="discordToken">Discord Bot Token</label>
  <input type="password" name="discordToken" id="discordToken" value="${c.discordToken||""}">
  <div class="grid">
    <div>
      <label for="slackBotToken">Slack Bot Token</label>
      <input type="password" name="slackBotToken" id="slackBotToken" value="${c.slackBotToken||""}">
    </div>
    <div>
      <label for="slackAppToken">Slack App Token</label>
      <input type="password" name="slackAppToken" id="slackAppToken" value="${c.slackAppToken||""}">
    </div>
  </div>
</div>
<button type="submit">Save & Restart Gateway</button>
</form>
<div class="card">
  <h2>Gateway Logs</h2>
  <pre class="log" id="logs">${escapeHtml(getGatewayLogs(60))}</pre>
  <button class="secondary" onclick="fetch('/setup/logs').then(r=>r.text()).then(t=>document.getElementById('logs').textContent=t)" style="margin:0">Refresh Logs</button>
</div>
`);
    }

    if (url.pathname === "/setup" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(renderOldSetupPage());
    }

    if (url.pathname === "/setup/save" && req.method === "POST") {
      try {
        const body = await parseBody(req);
        let cfg = loadConfig();
        const fields = [
          "provider", "apiKey", "solanaRpcUrl", "heliusApiKey",
          "privyAppId", "privyAppSecret",
          "telegramToken", "discordToken", "slackBotToken", "slackAppToken",
        ];
        for (const f of fields) {
          if (body[f] !== undefined) {
            if (body[f]) cfg[f] = body[f];
            else delete cfg[f];
          }
        }
        saveConfig(cfg);
        startGateway();
        res.writeHead(303, { Location: "/setup" });
        return res.end();
      } catch (e) {
        return json(res, { error: e.message }, 400);
      }
    }

    if (url.pathname === "/setup/reset" && req.method === "POST") {
      try { fs.unlinkSync(CONFIG_PATH); } catch {}
      if (gatewayProc && !gatewayProc.killed) {
        try { gatewayProc.kill(); } catch {}
      }
      return json(res, { status: "reset" });
    }

    if (url.pathname === "/setup/logs" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(getGatewayLogs(200));
    }

    return json(res, { error: "Not found" }, 404);
  }

  // Everything else proxies to the gateway
  proxyToGateway(req, res);
});

// WebSocket upgrade
server.on("upgrade", proxyUpgrade);

// ── Boot ───────────────────────────────────────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });

const cfg = loadConfig();
if (cfg.provider && cfg.apiKey) {
  console.log("[wrapper] Config found — starting gateway automatically");
  startGateway();
} else {
  console.log("[wrapper] No config found — visit the dashboard to configure");
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[wrapper] Nemo Clawd wrapper listening on :${PORT}`);
  console.log(`[wrapper] Dashboard:  http://0.0.0.0:${PORT}/`);
  console.log(`[wrapper] Health:     http://0.0.0.0:${PORT}/healthz`);
  console.log(`[wrapper] Admin key:  ${ADMIN_KEY}`);
});