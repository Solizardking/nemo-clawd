import { randomBytes, createHash } from "node:crypto";

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

export function generatePkcePair(): PkcePair {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest().toString("base64url");
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

export interface JwtPayload {
  email?: string;
  userID?: string;
  authSource?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

/** Decode the JWT middle segment without signature verification — display only. */
export function decodeJwtPayload(jwt: string): JwtPayload | null {
  try {
    const [, payloadB64] = jwt.split(".");
    if (!payloadB64) return null;
    return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as JwtPayload;
  } catch {
    return null;
  }
}

export function decodeJwtEmail(jwt: string): string | null {
  const payload = decodeJwtPayload(jwt);
  if (!payload) return null;
  if (typeof payload.email === "string") return payload.email;
  if (typeof payload.userID === "string") return payload.userID;
  return null;
}

export interface JwtIdentity {
  /** "email" when the userID looks like an email; "wallet" when it's a base58 pubkey. */
  kind: "email" | "wallet" | "unknown";
  /** Human-facing label: full email or shortened pubkey (e.g. "7xKX…3vQ"). */
  display: string;
  /** Raw identifier from the JWT (email or full pubkey). */
  raw: string;
}

function shortenPubkey(pk: string): string {
  if (pk.length <= 12) return pk;
  return `${pk.slice(0, 6)}…${pk.slice(-4)}`;
}

/** Inspect a JWT and produce a friendly identity descriptor for terminal output. */
export function describeJwtIdentity(jwt: string): JwtIdentity | null {
  const payload = decodeJwtPayload(jwt);
  if (!payload) return null;
  const raw
    = typeof payload.email === "string" && payload.email.length > 0
      ? payload.email
      : typeof payload.userID === "string"
        ? payload.userID
        : "";
  if (!raw) return null;
  if (raw.includes("@")) return { kind: "email", display: raw, raw };
  // Heuristic: base58-shaped userID without @ → treat as wallet pubkey.
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw)) {
    return { kind: "wallet", display: shortenPubkey(raw), raw };
  }
  return { kind: "unknown", display: raw, raw };
}
