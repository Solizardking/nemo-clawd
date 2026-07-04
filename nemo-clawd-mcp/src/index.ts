#!/usr/bin/env node
/**
 * nemoclawd MCP Server — STDIO entry point
 */

import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  createNemoclawdMcpServer,
  SERVER_NAME,
} from "./server.js";

export {
  createNemoclawdMcpServer,
  SERVER_NAME,
  SERVER_VERSION,
  TOOLS,
} from "./server.js";

export const server = createNemoclawdMcpServer();

async function startStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} running (stdio)`);
}

async function startHttp(): Promise<void> {
  await import("./http.js");
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  if (process.argv.includes("--http") || process.env.MCP_TRANSPORT === "http") {
    await startHttp();
  } else {
    await startStdio();
  }
}
