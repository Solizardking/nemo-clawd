import type { McpRemoteTransport } from "../utils/settings.js";

export interface McpCatalogEntry {
  id: string;
  name: string;
  description: string;
  directoryUrl: string;
  sourceUrl?: string;
  starterTransport?: McpRemoteTransport | "stdio";
}

export const POPULAR_MCP_CATALOG: McpCatalogEntry[] = [
  // Upstream MCP catalog entry removed: the upstream external MCP server
  // is not part of the Open Clawd distribution. Add an alternate entry here
  // if your local environment exposes a compatible issue/PR MCP server.
  {
    id: "supabase",
    name: "Supabase",
    description: "PostgREST-backed operations for Postgres databases.",
    directoryUrl: "https://cursor.directory/plugins/mcp-supabase",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Vercel infrastructure and deployment workflows.",
    directoryUrl: "https://cursor.directory/plugins/mcp-vercel",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "Workers, KV, R2, and D1 operations on Cloudflare.",
    directoryUrl: "https://cursor.directory/plugins/mcp-cloudflare",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Stripe API access for billing and payment workflows.",
    directoryUrl: "https://cursor.directory/plugins/mcp-stripe",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Databases, pages, blocks, and search inside Notion workspaces.",
    directoryUrl: "https://cursor.directory/plugins/mcp-notion",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Slack workspace messaging and channel workflows.",
    directoryUrl: "https://cursor.directory/plugins/mcp-slack",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Issue analysis and debugging workflows for Sentry projects.",
    directoryUrl: "https://cursor.directory/plugins/mcp-sentry",
  },
  {
    id: "figma",
    name: "Figma",
    description: "Design data from Figma for implementation workflows.",
    directoryUrl: "https://cursor.directory/plugins/mcp-figma",
  },
  {
    id: "firebase",
    name: "Firebase",
    description: "Auth, Firestore, and Storage operations.",
    directoryUrl: "https://cursor.directory/plugins/mcp-firebase",
  },
  {
    id: "docker",
    name: "Docker",
    description: "Manage containers, images, volumes, and networks.",
    directoryUrl: "https://cursor.directory/plugins/mcp-docker",
    starterTransport: "stdio",
  },
  {
    id: "prisma",
    name: "Prisma",
    description: "Prisma database workflows and Postgres management.",
    directoryUrl: "https://cursor.directory/plugins/mcp-prisma",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    description: "Read-only exploration, queries, and aggregation for MongoDB.",
    directoryUrl: "https://cursor.directory/plugins/mcp-mongodb",
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    description: "Browser automation via Puppeteer MCP.",
    directoryUrl: "https://cursor.directory/plugins/mcp-puppeteer",
    starterTransport: "stdio",
  },
  {
    id: "browserbase",
    name: "Browserbase",
    description: "Cloud browser automation workflows.",
    directoryUrl: "https://cursor.directory/plugins/mcp-browserbase",
  },
];
