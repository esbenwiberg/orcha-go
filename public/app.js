// @ts-check

(function () {
  "use strict";

  // ── Terminal setup ──────────────────────────────────────────────────
  var fontSize = 14;

  var term = new Terminal({
    cursorBlink: true,
    fontSize: fontSize,
    fontFamily: "monospace",
    theme: {
      background: "#0d0d0d",
      foreground: "#e0e0e0",
      cursor: "#9b59b6",
    },
  });

  var fitAddon = new FitAddon.FitAddon();
  var webLinksAddon = new WebLinksAddon.WebLinksAddon();

  term.loadAddon(fitAddon);
  term.loadAddon(webLinksAddon);

  var container = document.getElementById("terminal");
  term.open(container);
  fitAddon.fit();

  // ── Disable autocorrect/predictive text ──────────────────────────
  var textarea = container.querySelector(".xterm-helper-textarea");
  if (textarea) {
    textarea.setAttribute("autocomplete", "off");
    textarea.setAttribute("autocorrect", "off");
    textarea.setAttribute("autocapitalize", "off");
    textarea.setAttribute("spellcheck", "false");
  }

  // ── Status indicator ───────────────────────────────────────────────
  var statusEl = document.getElementById("status");

  function setStatus(text, state) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "status status-" + state;
  }

  // ── Key mapping ──────────────────────────────────────────────────
  var KEY_MAP = {
    esc: "\x1b",
    tab: "\t",
    enter: "\r",
    up: "\x1b[A",
    down: "\x1b[B",
    right: "\x1b[C",
    left: "\x1b[D",
    home: "\x1b[H",
    end: "\x1b[F",
    pgup: "\x1b[5~",
    pgdn: "\x1b[6~",
    pipe: "|",
    slash: "/",
    dash: "-",
    tilde: "~",
    underscore: "_",
    backtick: "`",
  };

  // ── Sticky modifiers ─────────────────────────────────────────────
  var modifiers = {
    ctrl: { active: false, locked: false, lastTap: 0 },
    alt: { active: false, locked: false, lastTap: 0 },
  };

  function handleModifierTap(mod) {
    var now = Date.now();
    var state = modifiers[mod];

    if (state.locked) {
      // Unlock
      state.locked = false;
      state.active = false;
    } else if (state.active && now - state.lastTap < 300) {
      // Double tap -> lock
      state.locked = true;
    } else {
      // Single tap -> activate for next key
      state.active = true;
    }
    state.lastTap = now;
    updateModifierUI();
  }

  function applyModifiers(data) {
    var modified = data;
    if (modifiers.ctrl.active || modifiers.ctrl.locked) {
      // Convert to Ctrl code: char.charCodeAt(0) - 64 for uppercase letters
      if (data.length === 1) {
        var code = data.toUpperCase().charCodeAt(0);
        if (code >= 65 && code <= 90) {
          modified = String.fromCharCode(code - 64);
        }
      }
      if (!modifiers.ctrl.locked) {
        modifiers.ctrl.active = false;
        updateModifierUI();
      }
    }
    if (modifiers.alt.active || modifiers.alt.locked) {
      modified = "\x1b" + modified; // Alt = ESC prefix
      if (!modifiers.alt.locked) {
        modifiers.alt.active = false;
        updateModifierUI();
      }
    }
    return modified;
  }

  var ctrlBtn = null;
  var altBtn = null;

  function updateModifierUI() {
    if (ctrlBtn) {
      ctrlBtn.classList.toggle("active", modifiers.ctrl.active || modifiers.ctrl.locked);
      ctrlBtn.classList.toggle("locked", modifiers.ctrl.locked);
    }
    if (altBtn) {
      altBtn.classList.toggle("active", modifiers.alt.active || modifiers.alt.locked);
      altBtn.classList.toggle("locked", modifiers.alt.locked);
    }
  }

  // ── Build extra keys toolbar ──────────────────────────────────────
  function createToolbar() {
    var toolbar = document.createElement("div");
    toolbar.className = "extra-keys";

    // Row 1: Esc, Tab, Ctrl, Alt, |, /, -, ~, _, `
    var row1 = document.createElement("div");
    row1.className = "key-row scrollable";

    var row1Keys = [
      { label: "Esc", key: "esc" },
      { label: "Tab", key: "tab" },
      { label: "Ctrl", key: "ctrl", modifier: true },
      { label: "Alt", key: "alt", modifier: true },
      { label: "|", key: "pipe" },
      { label: "/", key: "slash" },
      { label: "-", key: "dash" },
      { label: "~", key: "tilde" },
      { label: "_", key: "underscore" },
      { label: "`", key: "backtick" },
    ];

    row1Keys.forEach(function (def) {
      var btn = document.createElement("button");
      btn.className = "key-btn" + (def.modifier ? " modifier" : "");
      btn.textContent = def.label;
      btn.setAttribute("data-key", def.key);

      if (def.key === "ctrl") {
        ctrlBtn = btn;
      } else if (def.key === "alt") {
        altBtn = btn;
      }

      btn.addEventListener("touchstart", function (e) {
        e.preventDefault();
        handleKeyPress(def.key, def.modifier);
      });
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        handleKeyPress(def.key, def.modifier);
      });

      row1.appendChild(btn);
    });

    // Row 2: arrows, Home, End, PgUp, PgDn
    var row2 = document.createElement("div");
    row2.className = "key-row";

    var row2Keys = [
      { label: "\u2190", key: "left" },
      { label: "\u2191", key: "up" },
      { label: "\u2193", key: "down" },
      { label: "\u2192", key: "right" },
      { label: "Home", key: "home" },
      { label: "End", key: "end" },
      { label: "PgUp", key: "pgup" },
      { label: "PgDn", key: "pgdn" },
    ];

    row2Keys.forEach(function (def) {
      var btn = document.createElement("button");
      btn.className = "key-btn";
      btn.textContent = def.label;
      btn.setAttribute("data-key", def.key);

      btn.addEventListener("touchstart", function (e) {
        e.preventDefault();
        handleKeyPress(def.key, false);
      });
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        handleKeyPress(def.key, false);
      });

      row2.appendChild(btn);
    });

    toolbar.appendChild(row1);
    toolbar.appendChild(row2);
    document.body.appendChild(toolbar);
  }

  function handleKeyPress(key, isModifier) {
    if (isModifier) {
      handleModifierTap(key);
      return;
    }

    var data = KEY_MAP[key];
    if (data !== undefined) {
      var modified = applyModifiers(data);
      sendMessage({ type: "input", data: modified });
    }

    // Refocus the terminal so the virtual keyboard stays open
    term.focus();
  }

  createToolbar();

  // ── Virtual keyboard viewport handling ────────────────────────────
  // Chromium VirtualKeyboard API
  if ("virtualKeyboard" in navigator) {
    navigator.virtualKeyboard.overlaysContent = true;
    navigator.virtualKeyboard.addEventListener("geometrychange", function () {
      var height = navigator.virtualKeyboard.boundingRect.height;
      document.documentElement.style.setProperty(
        "--keyboard-height",
        height + "px"
      );
      fitAddon.fit();
    });
  }

  // Safari/Firefox fallback using visualViewport
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      var viewportHeight = window.visualViewport.height;
      document.documentElement.style.setProperty(
        "--viewport-height",
        viewportHeight + "px"
      );
      fitAddon.fit();
    });
  }

  // ── Pinch-to-zoom font size ───────────────────────────────────────
  var lastPinchDist = 0;

  container.addEventListener(
    "touchstart",
    function (e) {
      if (e.touches.length === 2) {
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    },
    { passive: true }
  );

  container.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches.length === 2) {
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        var delta = dist - lastPinchDist;
        if (Math.abs(delta) > 10) {
          fontSize = Math.max(8, Math.min(24, fontSize + (delta > 0 ? 1 : -1)));
          term.options.fontSize = fontSize;
          fitAddon.fit();
          lastPinchDist = dist;
        }
      }
    },
    { passive: true }
  );

  // ── WebSocket connection ───────────────────────────────────────────
  var ws = null;
  var reconnectDelay = 2000;
  var MAX_RECONNECT_DELAY = 30000;
  var reconnectTimer = null;

  function getWsUrl() {
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
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
    var modified = applyModifiers(data);
    sendMessage({ type: "input", data: modified });
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
