#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Telegram → Nemo Clawd bridge.
 *
 * Messages from Telegram are forwarded to the Nemo Clawd agent running
 * inside the sandbox. When the agent needs external access, the
 * OpenShell TUI lights up for approval. Responses go back to Telegram.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   ZAI_API_KEY         — for ZAI GLM 5.2 inference (preferred)
 *   NVIDIA_API_KEY      — fallback NVIDIA-hosted inference
 *   SANDBOX_NAME        — sandbox name (default: nemoclawd)
 *   ALLOWED_CHAT_IDS    — comma-separated Telegram chat IDs to accept (optional, accepts all if unset)
 */

const https = require("https");
const fs = require("fs");
const { execFileSync, spawn } = require("child_process");

function usage() {
  console.log(`Usage: telegram-bridge.js [--smoke-test]

Bridge Telegram messages to a Nemo Clawd agent running in an OpenShell sandbox.

Options:
  --smoke-test  Validate startup configuration without contacting Telegram.
  -h, --help    Show this help.`);
}

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  usage();
  process.exit(0);
}
const SMOKE_TEST = args.includes("--smoke-test");
const unknownArg = args.find((arg) => arg !== "--smoke-test");
if (unknownArg) {
  usage();
  console.error(`Unknown argument: ${unknownArg}`);
  process.exit(2);
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const INFERENCE_KEY_NAME = process.env.ZAI_API_KEY ? "ZAI_API_KEY" : "NVIDIA_API_KEY";
const API_KEY = process.env.ZAI_API_KEY || process.env.NVIDIA_API_KEY;
const MODEL = process.env.ZAI_API_KEY ? "zai/glm-5.2" : "nvidia/nemotron-3-super-120b-a12b";
const SANDBOX = process.env.SANDBOX_NAME || "nemoclawd";
const ALLOWED_CHATS = process.env.ALLOWED_CHAT_IDS
  ? process.env.ALLOWED_CHAT_IDS.split(",").map((s) => s.trim())
  : null;

if (SMOKE_TEST) {
  console.log(JSON.stringify({
    ok: true,
    sandbox: SANDBOX,
    model: MODEL,
    telegramTokenConfigured: Boolean(TOKEN),
    inferenceKeyName: API_KEY ? INFERENCE_KEY_NAME : null,
    allowedChatsConfigured: Boolean(ALLOWED_CHATS),
  }, null, 2));
  process.exit(0);
}

if (!TOKEN) { console.error("TELEGRAM_BOT_TOKEN required"); process.exit(1); }
if (!API_KEY) { console.error("ZAI_API_KEY or NVIDIA_API_KEY required"); process.exit(1); }

let offset = 0;
const activeSessions = new Map(); // chatId → message history

// ── Telegram API helpers ──────────────────────────────────────────

function tgApi(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${TOKEN}/${method}`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try { resolve(JSON.parse(buf)); } catch { resolve({ ok: false, error: buf }); }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function sendMessage(chatId, text, replyTo) {
  // Telegram max message length is 4096
  const chunks = [];
  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.slice(i, i + 4000));
  }
  for (const chunk of chunks) {
    await tgApi("sendMessage", {
      chat_id: chatId,
      text: chunk,
      reply_to_message_id: replyTo,
      parse_mode: "Markdown",
    }).catch(() =>
      // Retry without markdown if it fails (unbalanced formatting)
      tgApi("sendMessage", { chat_id: chatId, text: chunk, reply_to_message_id: replyTo }),
    );
  }
}

async function sendTyping(chatId) {
  await tgApi("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

// ── Run agent inside sandbox ──────────────────────────────────────

function runAgentInSandbox(message, sessionId) {
  return new Promise((resolve) => {
    const sshConfig = execFileSync("openshell", ["sandbox", "ssh-config", SANDBOX], { encoding: "utf-8" });

    // Write temp ssh config
    const safeSessionId = String(sessionId).replace(/[^A-Za-z0-9_.-]/g, "_");
    const confPath = `/tmp/nemoclawd-tg-ssh-${safeSessionId}.conf`;
    fs.writeFileSync(confPath, sshConfig, { mode: 0o600 });

    const escaped = message.replace(/'/g, "'\\''");
    const escapedApiKey = API_KEY.replace(/'/g, "'\\''");
    const cmd = `export ${INFERENCE_KEY_NAME}='${escapedApiKey}' && nemoclawd-start nemoclawd agent --agent main --local -m '${escaped}' --session-id 'tg-${sessionId}'`;

    const proc = spawn("ssh", ["-T", "-F", confPath, `openshell-${SANDBOX}`, cmd], {
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      try { fs.unlinkSync(confPath); } catch {}

      // Extract the actual agent response — skip setup lines
      const lines = stdout.split("\n");
      const responseLines = lines.filter(
        (l) =>
          !l.startsWith("Setting up Nemo Clawd") &&
          !l.startsWith("[plugins]") &&
          !l.startsWith("(node:") &&
          !l.includes("Nemo Clawd ready") &&
          !l.includes("Nemo Clawd registered") &&
          !l.includes("nemoclawd agent") &&
          !l.includes("┌─") &&
          !l.includes("│ ") &&
          !l.includes("└─") &&
          l.trim() !== "",
      );

      const response = responseLines.join("\n").trim();

      if (response) {
        resolve(response);
      } else if (code !== 0) {
        resolve(`Agent exited with code ${code}. ${stderr.trim().slice(0, 500)}`);
      } else {
        resolve("(no response)");
      }
    });

    proc.on("error", (err) => {
      resolve(`Error: ${err.message}`);
    });
  });
}

// ── Poll loop ─────────────────────────────────────────────────────

async function poll() {
  try {
    const res = await tgApi("getUpdates", { offset, timeout: 30 });

    if (res.ok && res.result?.length > 0) {
      for (const update of res.result) {
        offset = update.update_id + 1;

        const msg = update.message;
        if (!msg?.text) continue;

        const chatId = String(msg.chat.id);

        // Access control
        if (ALLOWED_CHATS && !ALLOWED_CHATS.includes(chatId)) {
          console.log(`[ignored] chat ${chatId} not in allowed list`);
          continue;
        }

        const userName = msg.from?.first_name || "someone";
        console.log(`[${chatId}] ${userName}: ${msg.text}`);

        // Handle /start
        if (msg.text === "/start") {
          await sendMessage(
            chatId,
            "*Nemo Clawd* — powered by " + MODEL + "\n\n" +
              "Send me a message and I'll run it through the Nemo Clawd agent " +
              "inside an OpenShell sandbox.\n\n" +
              "If the agent needs external access, the TUI will prompt for approval.",
            msg.message_id,
          );
          continue;
        }

        // Handle /reset
        if (msg.text === "/reset") {
          activeSessions.delete(chatId);
          await sendMessage(chatId, "Session reset.", msg.message_id);
          continue;
        }

        // Send typing indicator
        await sendTyping(chatId);

        // Keep a typing indicator going while agent runs
        const typingInterval = setInterval(() => sendTyping(chatId), 4000);

        try {
          const response = await runAgentInSandbox(msg.text, chatId);
          clearInterval(typingInterval);
          console.log(`[${chatId}] agent: ${response.slice(0, 100)}...`);
          await sendMessage(chatId, response, msg.message_id);
        } catch (err) {
          clearInterval(typingInterval);
          await sendMessage(chatId, `Error: ${err.message}`, msg.message_id);
        }
      }
    }
  } catch (err) {
    console.error("Poll error:", err.message);
  }

  // Continue polling
  setTimeout(poll, 100);
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const me = await tgApi("getMe", {});
  if (!me.ok) {
    console.error("Failed to connect to Telegram:", JSON.stringify(me));
    process.exit(1);
  }

  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────┐");
  console.log("  │  Nemo Clawd Telegram Bridge                          │");
  console.log("  │                                                     │");
  console.log(`  │  Bot:      @${(me.result.username + "                    ").slice(0, 37)}│`);
  console.log("  │  Sandbox:  " + (SANDBOX + "                              ").slice(0, 40) + "│");
  console.log("  │  Model:    " + (MODEL + "                                      ").slice(0, 37) + "│");
  console.log("  │                                                     │");
  console.log("  │  Messages are forwarded to the Nemo Clawd agent      │");
  console.log("  │  inside the sandbox. Run 'openshell term' in       │");
  console.log("  │  another terminal to monitor + approve egress.     │");
  console.log("  └─────────────────────────────────────────────────────┘");
  console.log("");

  poll();
}

main().catch((err) => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
