import chalk from "chalk";
import { decodeJwtPayload, describeJwtIdentity } from "../lib/oauth.js";
import { listProjects } from "../lib/api.js";
import { getJwt, getApiKey, getProjectId, getNetwork } from "../lib/config.js";
import {
  outputJson,
  handleCommandError,
  createSpinner,
  classifyError,
  type OutputOptions,
} from "../lib/output.js";

interface WhoamiOptions extends OutputOptions {
  verify?: boolean;
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 8)}…`;
}

function formatRelative(secondsFromNow: number): string {
  const abs = Math.abs(secondsFromNow);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);

  let parts: string;
  if (days > 0) parts = `${days}d ${hours}h`;
  else if (hours > 0) parts = `${hours}h ${mins}m`;
  else parts = `${mins}m`;

  return secondsFromNow >= 0 ? `in ${parts}` : `${parts} ago`;
}

export async function whoamiCommand(options: WhoamiOptions): Promise<void> {
  const spinner = createSpinner(options);

  try {
    const jwt = getJwt();
    const apiKey = getApiKey();
    const projectId = getProjectId();
    const network = getNetwork();

    if (!jwt) {
      if (options.json) {
        outputJson({
          status: "NOT_LOGGED_IN",
          apiKey: apiKey ? maskApiKey(apiKey) : null,
          projectId: projectId ?? null,
          network,
        });
        return;
      }
      console.log("Not logged in.");
      console.log(
        chalk.gray(
          "  • Run `helius login` if you have an existing Helius account (browser-based, OAuth/PKCE).",
        ),
      );
      console.log(
        chalk.gray("  • Run `helius signup` to create a new account (keypair + USDC)."),
      );
      if (apiKey) {
        console.log(
          chalk.gray(
            `\nNote: An API key is configured (${maskApiKey(apiKey)}) — RPC calls work, but account-management commands (projects, usage, billing) require a session token.`,
          ),
        );
      }
      return;
    }

    const payload = decodeJwtPayload(jwt);
    const identity = describeJwtIdentity(jwt);
    const authSource = (payload?.authSource as string | undefined) ?? "unknown";
    const exp = typeof payload?.exp === "number" ? payload.exp : null;
    const iat = typeof payload?.iat === "number" ? payload.iat : null;

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresInSec = exp !== null ? exp - nowSec : null;
    const expired = expiresInSec !== null && expiresInSec <= 0;

    let serverVerified: boolean | null = null;
    if (options.verify) {
      spinner?.start("Verifying token against backend...");
      try {
        await listProjects(jwt);
        serverVerified = true;
        spinner?.succeed("Token accepted by backend");
      } catch (verifyError) {
        // Only a genuine auth failure (revoked/expired JWT → 401/403) means the
        // token was rejected. Transient failures (network, 5xx, rate limit) must
        // surface as their own error rather than reading as a bad token.
        if (classifyError(verifyError).errorCode !== "INVALID_API_KEY") throw verifyError;
        serverVerified = false;
        spinner?.fail("Token rejected by backend");
      }
    }

    if (options.json) {
      outputJson({
        status: expired ? "EXPIRED" : "LOGGED_IN",
        identityKind: identity?.kind ?? "unknown",
        email: identity?.kind === "email" ? identity.raw : null,
        wallet: identity?.kind === "wallet" ? identity.raw : null,
        authSource,
        issuedAt: iat ? new Date(iat * 1000).toISOString() : null,
        expiresAt: exp ? new Date(exp * 1000).toISOString() : null,
        expiresInSeconds: expiresInSec,
        projectId: projectId ?? null,
        apiKey: apiKey ? maskApiKey(apiKey) : null,
        network,
        verified: serverVerified,
      });
      return;
    }

    const authSourceLabel
      = authSource === "cli" ? "cli (OAuth/PKCE)"
        : authSource === "supabase" ? "supabase (web session)"
        : authSource === "wallet" ? "wallet (on-chain signature)"
        : authSource;

    const identityLabel
      = identity?.kind === "email"
        ? chalk.cyan(identity.raw)
        : identity?.kind === "wallet"
          ? `${chalk.cyan(identity.display)} ${chalk.gray(`(${identity.raw})`)}`
          : chalk.gray("(unknown)");
    const identityField = identity?.kind === "wallet" ? "Wallet:     " : "Email:      ";
    console.log(`${chalk.gray(identityField)} ${identityLabel}`);
    console.log(`${chalk.gray("Auth source:")} ${authSourceLabel}`);
    if (exp !== null) {
      const expDate = new Date(exp * 1000);
      const rel = formatRelative(expiresInSec!);
      const expLine = `${expDate.toLocaleString()} (${rel})`;
      console.log(`${chalk.gray("Expires:")}     ${expired ? chalk.red(expLine) : expLine}`);
    }
    console.log(`${chalk.gray("Project:")}     ${projectId ? chalk.cyan(projectId) : chalk.gray("(none)")}`);
    console.log(`${chalk.gray("API key:")}     ${apiKey ? `${maskApiKey(apiKey)} (set)` : chalk.gray("(none)")}`);
    console.log(`${chalk.gray("Network:")}     ${network}`);
    if (serverVerified === true) {
      console.log(chalk.green("\n✓ Backend confirms token is valid."));
    } else if (serverVerified === false) {
      console.log(chalk.red("\n✖ Backend rejected the token — run `helius login` to re-authenticate."));
    }
    if (expired) {
      console.log(chalk.yellow("\n⚠ Session has expired. Run `helius login` to refresh."));
    }
  } catch (error) {
    handleCommandError(error, options, spinner);
  }
}
