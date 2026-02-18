import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SESSION_NAME = "orcha-go";
const WORKSPACE_DIR =
  process.env.WORKSPACE_DIR ||
  path.join(process.env.HOME || "/home", "workspaces");

/**
 * Checks whether the tmux session exists.
 */
export function hasSession(): boolean {
  try {
    execSync(`tmux has-session -t ${SESSION_NAME}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures the tmux session exists. Creates it if missing.
 * Returns the session name.
 */
export function ensureSession(): string {
  if (!hasSession()) {
    // Ensure workspace dir exists for tmux to start in
    if (!fs.existsSync(WORKSPACE_DIR)) {
      fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    }
    execSync(
      `tmux new-session -d -s ${SESSION_NAME} -x 80 -y 24 -c ${JSON.stringify(WORKSPACE_DIR)}`,
      {
        stdio: "ignore",
        env: { ...process.env, TERM: "xterm-256color" },
      },
    );
    console.log(`Created tmux session: ${SESSION_NAME}`);
  } else {
    console.log(`Reusing existing tmux session: ${SESSION_NAME}`);
  }
  return SESSION_NAME;
}

/**
 * Kills the tmux session if it exists.
 */
export function killSession(): void {
  if (hasSession()) {
    try {
      execSync(`tmux kill-session -t ${SESSION_NAME}`, { stdio: "ignore" });
      console.log(`Killed tmux session: ${SESSION_NAME}`);
    } catch {
      // Session may have already exited
    }
  }
}
