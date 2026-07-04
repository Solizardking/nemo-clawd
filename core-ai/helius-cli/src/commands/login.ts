import chalk from "chalk";
import { generatePkcePair, generateState, describeJwtIdentity } from "../lib/oauth.js";
import { startLoopback } from "../lib/loopback-server.js";
import { openInBrowser } from "../lib/browser.js";
import { oauthTokenExchange, listProjects } from "../lib/api.js";
import { getJwt, setJwt } from "../lib/config.js";
import {
  outputJson,
  handleCommandError,
  createSpinner,
  classifyError,
  type OutputOptions,
} from "../lib/output.js";

const DASHBOARD_URL = (process.env.HELIUS_DASHBOARD_URL ?? "https://dashboard.helius.dev").replace(
  /\/$/,
  "",
);
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

interface LoginOptions extends OutputOptions {
  /** Commander injects this — `--no-browser` flips it to false. Default true. */
  browser: boolean;
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  const spinner = createSpinner(options);

  try {
    // Already-logged-in short-circuit. Probe the JWT server-side via /projects
    // so a revoked-but-not-yet-expired token still triggers a fresh login.
    const existing = getJwt();
    if (existing) {
      try {
        await listProjects(existing);
        const identity = describeJwtIdentity(existing);
        const label = identity?.kind === "wallet"
          ? `wallet ${identity.display}`
          : (identity?.display ?? "your account");
        if (options.json) {
          outputJson({ status: "ALREADY_LOGGED_IN", identity: identity ?? null });
          return;
        }
        console.log(chalk.green(`✓ Already logged in as ${chalk.cyan(label)}.`));
        return;
      } catch (probeError) {
        // Only a genuine auth failure (revoked/expired JWT → 401/403) should
        // silently fall through to a fresh login. Transient failures (network,
        // 5xx, rate limit) must surface rather than forcing a confusing re-login.
        if (classifyError(probeError).errorCode !== "INVALID_API_KEY") throw probeError;
        // JWT invalid/revoked — fall through to fresh login.
      }
    }

    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = generateState();

    spinner?.start("Starting local server...");
    const loopback = await startLoopback(state);
    spinner?.succeed(`Listening on http://127.0.0.1:${loopback.port}`);

    const redirectUri = `http://127.0.0.1:${loopback.port}/oauth/callback`;
    const authUrl = new URL(`${DASHBOARD_URL}/authorize`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", "helius-cli");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    const useBrowser = options.browser && !process.env.NO_BROWSER;

    if (options.json) {
      outputJson({ status: "AWAITING_CALLBACK", verification_uri: authUrl.toString() });
    } else if (!useBrowser) {
      console.log("Open this URL to authenticate:\n");
      console.log(chalk.cyan(authUrl.toString()));
      console.log();
    } else {
      console.log("Attempting to open your default browser.");
      console.log("If the browser does not open, open the following URL:\n");
      console.log(chalk.cyan(authUrl.toString()));
      console.log();
      openInBrowser(authUrl.toString());
    }

    spinner?.start("Waiting for browser confirmation...");
    let code: string;
    try {
      code = await loopback.awaitCallback(LOGIN_TIMEOUT_MS);
    } finally {
      loopback.close();
    }
    spinner?.succeed("Authorization received");

    spinner?.start("Exchanging authorization code...");
    const result = await oauthTokenExchange({
      code,
      codeVerifier,
      clientId: "helius-cli",
      redirectUri,
    });
    setJwt(result.access_token);

    // Wallet users have a null email; identify them by their userID (pubkey)
    // and label as "wallet …". Email users keep the normal display.
    const successIdentity = describeJwtIdentity(result.access_token);
    const successLabel
      = result.user.email
        ? result.user.email
        : successIdentity?.kind === "wallet"
          ? `wallet ${successIdentity.display}`
          : (result.user.id ?? "your account");
    spinner?.succeed(`Successfully logged in as ${chalk.cyan(successLabel)}`);

    if (options.json) {
      outputJson({
        status: "SUCCESS",
        user: result.user,
        identity: successIdentity ?? null,
        expires_at: new Date(Date.now() + result.expires_in * 1000).toISOString(),
      });
    } else {
      console.log(chalk.gray("JWT saved to ~/.helius/config.json"));
    }
  } catch (error) {
    handleCommandError(error, options, spinner, "AUTH_FAILED");
  }
}
