import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocks must be hoisted — vi.mock is hoisted automatically before imports.
vi.mock("../src/lib/browser.js", () => ({ openInBrowser: vi.fn(() => true) }));

const setJwtMock = vi.fn();
const getJwtMock = vi.fn<() => string | undefined>();
vi.mock("../src/lib/config.js", () => ({
  getJwt: () => getJwtMock(),
  setJwt: (jwt: string) => setJwtMock(jwt),
}));

const oauthTokenExchangeMock = vi.fn();
const listProjectsMock = vi.fn();
vi.mock("../src/lib/api.js", () => ({
  oauthTokenExchange: (args: unknown) => oauthTokenExchangeMock(args),
  listProjects: (jwt: string) => listProjectsMock(jwt),
}));

// We hit the loopback server directly from the test, so use the real implementation.

import { loginCommand } from "../src/commands/login.js";
import { openInBrowser } from "../src/lib/browser.js";

function hitCallback(port: number, params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  return fetch(`http://127.0.0.1:${port}/oauth/callback?${qs.toString()}`).then((r) => r.text());
}

let exitSpy: ReturnType<typeof vi.spyOn>;
let exitCode: number | undefined;
let stdout: string;
let stderr: string;
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  exitCode = undefined;
  stdout = "";
  stderr = "";
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    exitCode = code;
    throw new Error(`__EXIT_${code}__`);
  }) as never);
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: any) => {
    stdout += String(chunk);
    return true;
  }) as never);
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(((chunk: any) => {
    stderr += String(chunk);
    return true;
  }) as never);
  vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
    stdout += args.map(String).join(" ") + "\n";
  });
  vi.spyOn(console, "error").mockImplementation((...args: any[]) => {
    stderr += args.map(String).join(" ") + "\n";
  });
  // Quiet PostHog / feedback paths if any.
  delete process.env.NO_BROWSER;
});

afterEach(() => {
  exitSpy.mockRestore();
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  vi.restoreAllMocks();
});

async function run(options: Partial<{ json: boolean; browser: boolean }> = {}) {
  const opts = { json: false, browser: true, ...options };
  try {
    await loginCommand(opts as never);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.startsWith("__EXIT_")) throw e;
  }
}

describe("loginCommand", () => {
  it("happy path: writes JWT and reports success", async () => {
    getJwtMock.mockReturnValue(undefined);
    oauthTokenExchangeMock.mockImplementation(async (args: any) => {
      // Validate the args structure on the way through.
      expect(args.clientId).toBe("helius-cli");
      expect(args.code).toBe("AUTH_CODE");
      expect(args.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(args.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback$/);
      return {
        access_token: "JWT_TOKEN",
        token_type: "Bearer" as const,
        expires_in: 7 * 24 * 3600,
        user: { id: "user-1", email: "alice@example.com" },
      };
    });

    const loginPromise = run({ browser: false });

    // Wait for the loopback to be up. Poll briefly — the command starts listening
    // synchronously inside startLoopback before printing the URL.
    let port: number | undefined;
    for (let i = 0; i < 50 && !port; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const m = stdout.match(/127\.0\.0\.1(?::|%3A)(\d+)/);
      if (m) port = Number(m[1]);
    }
    expect(port).toBeDefined();

    const state = stdout.match(/state=([A-Za-z0-9_-]+)/)?.[1];
    expect(state).toBeDefined();

    await hitCallback(port!, { code: "AUTH_CODE", state: state! });
    await loginPromise;

    expect(setJwtMock).toHaveBeenCalledWith("JWT_TOKEN");
    expect(exitCode).toBeUndefined();
  });

  it("state mismatch: exits with AUTH_FAILED", async () => {
    getJwtMock.mockReturnValue(undefined);

    const loginPromise = run({ browser: false });

    let port: number | undefined;
    for (let i = 0; i < 50 && !port; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const m = stdout.match(/127\.0\.0\.1(?::|%3A)(\d+)/);
      if (m) port = Number(m[1]);
    }

    await hitCallback(port!, { code: "AUTH_CODE", state: "WRONG_STATE" });
    await loginPromise;

    expect(setJwtMock).not.toHaveBeenCalled();
    expect(exitCode).toBe(12);
  });

  it("error=access_denied on callback: exits with AUTH_FAILED", async () => {
    getJwtMock.mockReturnValue(undefined);

    const loginPromise = run({ browser: false });

    let port: number | undefined;
    for (let i = 0; i < 50 && !port; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const m = stdout.match(/127\.0\.0\.1(?::|%3A)(\d+)/);
      if (m) port = Number(m[1]);
    }

    await hitCallback(port!, { error: "access_denied", state: "x" });
    await loginPromise;

    expect(setJwtMock).not.toHaveBeenCalled();
    expect(exitCode).toBe(12);
  });

  it("invalid_grant from token endpoint: exits with AUTH_FAILED", async () => {
    getJwtMock.mockReturnValue(undefined);
    oauthTokenExchangeMock.mockRejectedValue(
      Object.assign(new Error("PKCE verification failed"), { code: "invalid_grant", status: 400 }),
    );

    const loginPromise = run({ browser: false });

    let port: number | undefined;
    for (let i = 0; i < 50 && !port; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const m = stdout.match(/127\.0\.0\.1(?::|%3A)(\d+)/);
      if (m) port = Number(m[1]);
    }
    const state = stdout.match(/state=([A-Za-z0-9_-]+)/)?.[1];

    await hitCallback(port!, { code: "AUTH_CODE", state: state! });
    await loginPromise;

    expect(setJwtMock).not.toHaveBeenCalled();
    expect(exitCode).toBe(12);
  });

  it("--no-browser: openInBrowser is not called, URL is printed", async () => {
    getJwtMock.mockReturnValue(undefined);
    oauthTokenExchangeMock.mockResolvedValue({
      access_token: "JWT_TOKEN",
      token_type: "Bearer",
      expires_in: 7 * 24 * 3600,
      user: { id: "u", email: "e@x.com" },
    });

    const loginPromise = run({ browser: false });
    let port: number | undefined;
    for (let i = 0; i < 50 && !port; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const m = stdout.match(/127\.0\.0\.1(?::|%3A)(\d+)/);
      if (m) port = Number(m[1]);
    }
    const state = stdout.match(/state=([A-Za-z0-9_-]+)/)?.[1];

    await hitCallback(port!, { code: "C", state: state! });
    await loginPromise;

    expect(openInBrowser).not.toHaveBeenCalled();
    expect(stdout).toContain("Open this URL to authenticate");
  });

  it("already-logged-in: short-circuits when listProjects succeeds", async () => {
    // JWT with payload { email: 'bob@example.com' } — base64url of {"email":"bob@example.com"}
    const payload = Buffer.from(JSON.stringify({ email: "bob@example.com" })).toString("base64url");
    getJwtMock.mockReturnValue(`header.${payload}.sig`);
    listProjectsMock.mockResolvedValue([{ id: "p1", name: "test" }]);

    await run({ browser: false });

    expect(setJwtMock).not.toHaveBeenCalled();
    expect(oauthTokenExchangeMock).not.toHaveBeenCalled();
    expect(stdout).toContain("Already logged in as");
    expect(exitCode).toBeUndefined();
  });

  it("stale JWT (auth failure): falls through to a fresh login", async () => {
    getJwtMock.mockReturnValue("header.payload.sig");
    // Revoked/expired JWT — auth SDK throws "API error (401): ..." → INVALID_API_KEY.
    listProjectsMock.mockRejectedValue(new Error("API error (401): unauthorized"));
    oauthTokenExchangeMock.mockResolvedValue({
      access_token: "FRESH_JWT",
      token_type: "Bearer",
      expires_in: 7 * 24 * 3600,
      user: { id: "u", email: "e@x.com" },
    });

    const loginPromise = run({ browser: false });

    let port: number | undefined;
    for (let i = 0; i < 50 && !port; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const m = stdout.match(/127\.0\.0\.1(?::|%3A)(\d+)/);
      if (m) port = Number(m[1]);
    }
    expect(port).toBeDefined();
    const state = stdout.match(/state=([A-Za-z0-9_-]+)/)?.[1];

    await hitCallback(port!, { code: "AUTH_CODE", state: state! });
    await loginPromise;

    // Stale token discarded, fresh login completed.
    expect(setJwtMock).toHaveBeenCalledWith("FRESH_JWT");
    expect(exitCode).toBeUndefined();
  });

  it("transient probe failure: surfaces instead of silently re-logging in", async () => {
    getJwtMock.mockReturnValue("header.payload.sig");
    // 5xx during the already-logged-in probe → SERVER_ERROR (exit 57), not a re-login.
    listProjectsMock.mockRejectedValue(new Error("API error (500): boom"));

    await run({ browser: false });

    expect(oauthTokenExchangeMock).not.toHaveBeenCalled();
    expect(setJwtMock).not.toHaveBeenCalled();
    expect(exitCode).toBe(57);
  });
});
