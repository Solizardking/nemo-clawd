#!/usr/bin/env node
/**
 * nemoclawd MCP Server — HTTP transport entry point
 *
 * Used by `npm run start:http` and the Fly.io deployment.
 * Exposes Streamable HTTP at /mcp, legacy SSE at /sse, and health at /health.
 */

import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createNemoclawdMcpServer,
  SERVER_NAME,
  SERVER_VERSION,
  TOOLS,
} from "./server.js";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const MCP_API_KEY = process.env.MCP_API_KEY ?? "";

type SseSession = {
  server: ReturnType<typeof createNemoclawdMcpServer>;
  transport: SSEServerTransport;
};

type StreamableSession = {
  server: ReturnType<typeof createNemoclawdMcpServer>;
  transport: StreamableHTTPServerTransport;
};

const sseSessions = new Map<string, SseSession>();
const streamableSessions = new Map<string, StreamableSession>();

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type,Mcp-Session-Id,mcp-session-id"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id,mcp-session-id");
}

function unauthorized(res: ServerResponse): void {
  sendJson(res, 401, { error: "Unauthorized" });
}

function methodNotAllowed(res: ServerResponse, allow: string): void {
  res.writeHead(405, {
    Allow: allow,
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify({ error: "Method Not Allowed", allow }));
}

function notFound(res: ServerResponse): void {
  sendJson(res, 404, { error: "Not Found" });
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!MCP_API_KEY) {
    return true;
  }

  return req.headers.authorization === `Bearer ${MCP_API_KEY}`;
}

function healthCheck(res: ServerResponse): void {
  sendJson(res, 200, {
    status: "healthy",
    error: null,
    server_name: SERVER_NAME,
    version: SERVER_VERSION,
    transports: {
      streamable_http: "/mcp",
      sse: "/sse",
      messages: "/messages",
    },
  });
}

function serverInfo(res: ServerResponse): void {
  sendJson(res, 200, {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    tools: TOOLS.length,
    endpoints: {
      health: "/health",
      streamable_http: "/mcp",
      sse: "/sse",
      sse_messages: "/messages",
    },
  });
}

async function startSse(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const transport = new SSEServerTransport("/messages", res);
  const server = createNemoclawdMcpServer();

  sseSessions.set(transport.sessionId, { server, transport });
  transport.onclose = () => {
    sseSessions.delete(transport.sessionId);
  };

  await server.connect(transport);
}

async function handleSseMessage(
  req: IncomingMessage,
  res: ServerResponse,
  sessionId: string | null
): Promise<void> {
  if (!sessionId) {
    sendJson(res, 400, { error: "Missing sessionId" });
    return;
  }

  const session = sseSessions.get(sessionId);
  if (!session) {
    sendJson(res, 404, { error: "Unknown SSE session" });
    return;
  }

  await session.transport.handlePostMessage(req, res);
}

async function createStreamableSession(): Promise<StreamableSession> {
  let activeSessionId: string | undefined;
  const server = createNemoclawdMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    onsessioninitialized: (sessionId) => {
      activeSessionId = sessionId;
      streamableSessions.set(sessionId, { server, transport });
    },
    onsessionclosed: (sessionId) => {
      streamableSessions.delete(sessionId);
    },
  });

  transport.onclose = () => {
    if (activeSessionId) {
      streamableSessions.delete(activeSessionId);
    }
  };

  await server.connect(transport);
  return { server, transport };
}

async function handleStreamableMcp(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const sessionHeader = req.headers["mcp-session-id"];
  const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;

  if (sessionId) {
    const session = streamableSessions.get(sessionId);
    if (!session) {
      sendJson(res, 404, { error: "Unknown MCP session" });
      return;
    }

    await session.transport.handleRequest(req, res);
    return;
  }

  const session = await createStreamableSession();
  await session.transport.handleRequest(req, res);

  if (!session.transport.sessionId) {
    await session.server.close();
  }
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  setCorsHeaders(res);

  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === "/health" || pathname === "/healthz") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        methodNotAllowed(res, "GET, HEAD");
        return;
      }
      healthCheck(res);
      return;
    }

    if (pathname === "/" && req.method === "GET") {
      serverInfo(res);
      return;
    }

    if (!isAuthorized(req)) {
      unauthorized(res);
      return;
    }

    if (pathname === "/sse") {
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      await startSse(req, res);
      return;
    }

    if (pathname === "/messages") {
      if (req.method !== "POST") {
        methodNotAllowed(res, "POST");
        return;
      }
      await handleSseMessage(req, res, url.searchParams.get("sessionId"));
      return;
    }

    if (pathname === "/mcp" || (pathname === "/" && req.method !== "GET")) {
      await handleStreamableMcp(req, res);
      return;
    }

    notFound(res);
  } catch (error) {
    console.error("HTTP MCP request failed", error);
    if (!res.headersSent) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      res.end();
    }
  }
});

httpServer.listen(PORT, () => {
  console.error(`${SERVER_NAME} running (http) on port ${PORT}`);
  console.error(`Streamable HTTP endpoint: http://localhost:${PORT}/mcp`);
  console.error(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.error(`Health endpoint: http://localhost:${PORT}/health`);
});
