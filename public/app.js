// @ts-check

(function () {
  "use strict";

  // ── Terminal setup ──────────────────────────────────────────────────
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "monospace",
    theme: {
      background: "#0d0d0d",
      foreground: "#e0e0e0",
      cursor: "#9b59b6",
    },
  });

  const fitAddon = new FitAddon.FitAddon();
  const webLinksAddon = new WebLinksAddon.WebLinksAddon();

  term.loadAddon(fitAddon);
  term.loadAddon(webLinksAddon);

  const container = document.getElementById("terminal");
  term.open(container);
  fitAddon.fit();

  // ── Status indicator ───────────────────────────────────────────────
  const statusEl = document.getElementById("status");

  function setStatus(text, state) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "status status-" + state;
  }

  // ── WebSocket connection ───────────────────────────────────────────
  let ws = null;
  let reconnectDelay = 2000;
  const MAX_RECONNECT_DELAY = 30000;
  let reconnectTimer = null;

  function getWsUrl() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + location.host + "/ws";
  }

  function sendMessage(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    setStatus("Connecting...", "connecting");
    ws = new WebSocket(getWsUrl());

    ws.onopen = function () {
      setStatus("Connected", "connected");
      reconnectDelay = 2000; // reset backoff on success

      // Send initial resize so server knows our dimensions
      sendMessage({
        type: "resize",
        cols: term.cols,
        rows: term.rows,
      });
    };

    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);

        switch (msg.type) {
          case "output":
            term.write(msg.data);
            break;
          case "connected":
            console.log("Connected to session:", msg.session);
            break;
          case "exit":
            console.log("Terminal exited with code:", msg.code);
            setStatus("Disconnected", "disconnected");
            break;
        }
      } catch (err) {
        console.error("Failed to parse server message:", err);
      }
    };

    ws.onclose = function () {
      ws = null;
      setStatus("Reconnecting...", "connecting");
      scheduleReconnect();
    };

    ws.onerror = function (err) {
      console.error("WebSocket error:", err);
      // onclose will fire after onerror, so reconnect logic is handled there
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      connect();
    }, reconnectDelay);
  }

  // ── Terminal input -> WebSocket ────────────────────────────────────
  term.onData(function (data) {
    sendMessage({ type: "input", data: data });
  });

  // ── Resize handling ────────────────────────────────────────────────
  function handleResize() {
    fitAddon.fit();
    sendMessage({
      type: "resize",
      cols: term.cols,
      rows: term.rows,
    });
  }

  window.addEventListener("resize", handleResize);

  // ── Start ──────────────────────────────────────────────────────────
  connect();
})();
