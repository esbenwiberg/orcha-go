import express from "express";
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import { ensureSession, hasSession } from "./session-manager.js";
import * as repoManager from "./repo-manager.js";
import * as tokenStore from "./token-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "8080", 10);

// Create HTTP server wrapping Express
const server = createServer(app);

// JSON body parsing
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, "..", "public")));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── Repo endpoints ──────────────────────────────────────────────────

app.get("/api/repos", (_req, res) => {
  res.json(repoManager.listRepos());
});

app.post("/api/repos", (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: "URL required" });
    return;
  }
  try {
    const token = tokenStore.getToken() || undefined;
    const repo = repoManager.cloneRepo(url, token);
    res.json(repo);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete("/api/repos/:name", (req, res) => {
  try {
    repoManager.deleteRepo(req.params.name);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Token endpoints ─────────────────────────────────────────────────

app.put("/api/token", (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "Token required" });
    return;
  }
  try {
    tokenStore.storeToken(token);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/token/status", (_req, res) => {
  res.json({ configured: tokenStore.hasToken() });
});

// ── Session endpoints ───────────────────────────────────────────────

app.get("/api/session", (_req, res) => {
  res.json({
    active: hasSession(),
    tmuxSession: "orcha-go",
  });
});

app.post("/api/session/switch", (req, res) => {
  const { repo } = req.body as { repo?: string };
  if (!repo) {
    res.status(400).json({ error: "Repo name required" });
    return;
  }
  const repoInfo = repoManager.getRepo(repo);
  if (!repoInfo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }
  try {
    execSync(
      `tmux send-keys -t orcha-go "cd '${repoInfo.path}' && clear" Enter`,
      { stdio: "ignore" },
    );
    res.json({ ok: true, path: repoInfo.path });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// WebSocket server on a distinct path to avoid conflicts
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  // Only handle upgrades on /ws path
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (url.pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket) => {
  console.log("WebSocket client connected");

  let ptyProcess: pty.IPty | null = null;

  try {
    // Ensure the tmux session exists
    const sessionName = ensureSession();

    // Spawn node-pty attaching to the tmux session
    ptyProcess = pty.spawn(
      "tmux",
      ["attach-session", "-t", sessionName],
      {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: process.env.WORKSPACE_DIR || process.env.HOME || "/",
        env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
      },
    );

    // Send connected message
    wsSend(ws, { type: "connected", session: sessionName });

    // PTY -> WebSocket
    ptyProcess.onData((data: string) => {
      wsSend(ws, { type: "output", data });
    });

    // PTY exit -> WebSocket
    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      console.log(`PTY exited with code ${exitCode}`);
      wsSend(ws, { type: "exit", code: exitCode });
      ws.close();
    });

    // WebSocket -> PTY
    ws.on("message", (raw: Buffer | string) => {
      if (!ptyProcess) return;

      try {
        const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());

        switch (msg.type) {
          case "input":
            ptyProcess.write(msg.data);
            break;
          case "resize":
            if (
              typeof msg.cols === "number" &&
              typeof msg.rows === "number" &&
              msg.cols > 0 &&
              msg.rows > 0
            ) {
              ptyProcess.resize(msg.cols, msg.rows);
            }
            break;
          default:
            console.warn("Unknown message type:", msg.type);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    });

    // WebSocket close -> kill PTY (detaches from tmux; session stays alive)
    ws.on("close", () => {
      console.log("WebSocket client disconnected");
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch {
          // PTY may have already exited
        }
        ptyProcess = null;
      }
    });

    ws.on("error", (err: Error) => {
      console.error("WebSocket error:", err.message);
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch {
          // PTY may have already exited
        }
        ptyProcess = null;
      }
    });
  } catch (err) {
    console.error("Failed to set up terminal session:", err);
    wsSend(ws, { type: "exit", code: 1 });
    ws.close();
  }
});

/**
 * Safely send a JSON message over the WebSocket.
 */
function wsSend(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

server.listen(PORT, () => {
  console.log(`Orcha Go server listening on port ${PORT}`);
});
