import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface LoopbackResult {
  port: number;
  awaitCallback: (timeoutMs: number) => Promise<string>;
  close: () => void;
}

const SUCCESS_PAGE =
  "<!doctype html><html><body style=\"font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 80px auto; text-align: center;\">" +
  "<h1>Logged in</h1><p>You can close this tab and return to your terminal.</p></body></html>";

// `msg` can carry the attacker-controllable OAuth `error` query param — always escape.
const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const ERROR_PAGE = (msg: string) =>
  "<!doctype html><html><body style=\"font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 80px auto; text-align: center;\">" +
  `<h1>Login failed</h1><p>${escapeHtml(msg)}</p><p>Return to your terminal for details.</p></body></html>`;

/**
 * Starts an HTTP server bound to 127.0.0.1 on a random port (RFC 8252 §7.3).
 * Resolves when the browser hits `/oauth/callback` with a `code` and a `state`
 * matching `expectedState`.
 *
 * `state` is validated inside the request handler — not later — so the browser
 * reflects the real outcome (a mismatch serves the error page, not "Logged in")
 * and an early bad hit can't poison the flow. `awaitCallback` resolves to the
 * raw authorization `code` (no encoding assumptions about its charset).
 *
 * The returned `awaitCallback` rejects on:
 *   - `OAUTH_ERROR:<error>` if the callback URL includes an `error` param
 *   - `NO_CODE` if neither code nor error is present
 *   - `STATE_MISMATCH` if the returned state doesn't match the expected value
 *   - `TIMEOUT` if no callback arrives within the timeout
 */
export async function startLoopback(expectedState: string): Promise<LoopbackResult> {
  const server: Server = createServer();
  let resolveCb!: (value: string) => void;
  let rejectCb!: (err: Error) => void;
  const cbPromise = new Promise<string>((res, rej) => {
    resolveCb = res;
    rejectCb = rej;
  });

  server.on("request", (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/oauth/callback") {
      res.writeHead(404).end();
      return;
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Serve an error page + reject, closing the connection so `helius login`
    // returns immediately rather than waiting on a keep-alive socket.
    const fail = (msg: string, err: Error) => {
      res.writeHead(400, { "Content-Type": "text/html", Connection: "close" });
      res.end(ERROR_PAGE(msg));
      rejectCb(err);
    };

    if (error) {
      fail(error, new Error(`OAUTH_ERROR:${error}`));
      return;
    }
    if (!code) {
      fail("missing authorization code", new Error("NO_CODE"));
      return;
    }
    if (state !== expectedState) {
      fail("state mismatch — possible CSRF, please retry", new Error("STATE_MISMATCH"));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html", Connection: "close" });
    res.end(SUCCESS_PAGE);
    resolveCb(code);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const port = (server.address() as AddressInfo).port;

  return {
    port,
    awaitCallback: async (timeoutMs) => {
      let timeoutHandle: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<string>((_, rej) => {
        timeoutHandle = setTimeout(() => rej(new Error("TIMEOUT")), timeoutMs);
      });
      try {
        return await Promise.race([cbPromise, timeoutPromise]);
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    },
    // Stop accepting connections and tear down idle keep-alive sockets
    // (Node 18.2+) so the process can exit without waiting on a timeout.
    close: () => {
      server.close();
      server.closeAllConnections?.();
    },
  };
}
