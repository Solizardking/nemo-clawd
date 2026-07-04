import { spawn } from "node:child_process";

/**
 * Opens `url` in the user's default browser. Detached + unref'd so the CLI
 * doesn't wait on it. Returns false if the platform launcher couldn't spawn.
 *
 * INVARIANT: `url` must be fully app-constructed — never user- or
 * server-influenced. On Windows this spawns `cmd /c start <url>`, and cmd
 * treats `&`, `^`, `%VAR%` etc. as shell metacharacters even in spawn args,
 * so an attacker-shaped URL would be command injection. The http(s) guard
 * below is defense-in-depth, not a substitute for that invariant.
 */
export function openInBrowser(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") return false;
  } catch {
    return false;
  }
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "\"\"", url] : [url];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
