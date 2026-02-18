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
  var statusDot = null;
  var statusFadeTimer = null;

  function setStatus(text, state) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "status status-" + state;

    // Update header status dot
    if (statusDot) {
      statusDot.className = "status-dot " + state;
    }

    // Auto-fade the connected status after 3 seconds
    if (statusFadeTimer) {
      clearTimeout(statusFadeTimer);
      statusFadeTimer = null;
    }
    if (state === "connected") {
      statusEl.style.opacity = "1";
      statusFadeTimer = setTimeout(function () {
        statusEl.style.opacity = "0";
      }, 3000);
    } else {
      statusEl.style.opacity = "1";
    }
  }

  // ── Skeleton loading ──────────────────────────────────────────────
  var initialLoad = true;

  function showSkeleton() {
    var skeleton = document.createElement("div");
    skeleton.id = "skeleton";
    skeleton.className = "skeleton-loading";
    for (var i = 0; i < 8; i++) {
      var line = document.createElement("div");
      line.className = "skeleton-line";
      line.style.width = (30 + Math.random() * 60) + "%";
      skeleton.appendChild(line);
    }
    container.appendChild(skeleton);
  }

  function hideSkeleton() {
    var skeleton = document.getElementById("skeleton");
    if (skeleton) skeleton.remove();
  }

  // Show skeleton on initial page load
  showSkeleton();

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

  // ── API helpers ──────────────────────────────────────────────────
  function fetchRepos() {
    return fetch("/api/repos").then(function (r) { return r.json(); });
  }

  function cloneRepo(url) {
    return fetch("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url }),
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
      return r.json();
    });
  }

  function deleteRepoApi(name) {
    return fetch("/api/repos/" + encodeURIComponent(name), { method: "DELETE" })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
        return r.json();
      });
  }

  function switchRepo(name) {
    return fetch("/api/session/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo: name }),
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
      return r.json();
    });
  }

  function saveToken(token) {
    return fetch("/api/token", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token }),
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
      return r.json();
    });
  }

  function getTokenStatus() {
    return fetch("/api/token/status").then(function (r) { return r.json(); });
  }

  // ── Sheet helpers ────────────────────────────────────────────────
  function showSheet(el) {
    el.classList.add("visible");
  }

  function hideSheet(el) {
    el.classList.remove("visible");
    term.focus();
  }

  // ── Header bar ───────────────────────────────────────────────────
  var repoNameEl;

  function createHeader() {
    var header = document.createElement("div");
    header.id = "header";

    statusDot = document.createElement("span");
    statusDot.className = "status-dot connecting";

    repoNameEl = document.createElement("span");
    repoNameEl.id = "repo-name";
    repoNameEl.textContent = "No repo";

    var leftGroup = document.createElement("div");
    leftGroup.style.display = "flex";
    leftGroup.style.alignItems = "center";
    leftGroup.style.minWidth = "0";
    leftGroup.appendChild(statusDot);
    leftGroup.appendChild(repoNameEl);

    var btnGroup = document.createElement("div");

    var reposBtn = document.createElement("button");
    reposBtn.id = "repos-btn";
    reposBtn.title = "Repos";
    reposBtn.textContent = "\uD83D\uDCC2"; // folder emoji
    reposBtn.addEventListener("click", function () {
      refreshRepoList();
      showSheet(repoSheet);
    });

    var settingsBtn = document.createElement("button");
    settingsBtn.id = "settings-btn";
    settingsBtn.title = "Settings";
    settingsBtn.textContent = "\u2699\uFE0F"; // gear emoji
    settingsBtn.addEventListener("click", function () {
      refreshTokenStatus();
      showSheet(settingsSheet);
    });

    btnGroup.appendChild(reposBtn);
    btnGroup.appendChild(settingsBtn);
    header.appendChild(leftGroup);
    header.appendChild(btnGroup);
    document.body.insertBefore(header, document.body.firstChild);
  }

  // ── Repo bottom sheet ────────────────────────────────────────────
  var repoSheet;
  var repoListEl;
  var cloneInput;
  var cloneBtn;
  var cloneLoadingEl;

  function createRepoSheet() {
    repoSheet = document.createElement("div");
    repoSheet.className = "bottom-sheet";

    var backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.addEventListener("click", function () { hideSheet(repoSheet); });

    var content = document.createElement("div");
    content.className = "sheet-content";

    // Header row
    var sheetHeader = document.createElement("div");
    sheetHeader.className = "sheet-header";
    var h2 = document.createElement("h2");
    h2.textContent = "Repositories";
    var closeBtn = document.createElement("button");
    closeBtn.className = "sheet-close";
    closeBtn.textContent = "\u2715"; // x mark
    closeBtn.addEventListener("click", function () { hideSheet(repoSheet); });
    sheetHeader.appendChild(h2);
    sheetHeader.appendChild(closeBtn);

    // Clone form
    var form = document.createElement("div");
    form.className = "clone-form";
    cloneInput = document.createElement("input");
    cloneInput.type = "text";
    cloneInput.placeholder = "https://github.com/user/repo";
    cloneBtn = document.createElement("button");
    cloneBtn.textContent = "Clone";
    cloneBtn.addEventListener("click", handleClone);
    // Allow Enter key in input to trigger clone
    cloneInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") handleClone();
    });
    form.appendChild(cloneInput);
    form.appendChild(cloneBtn);

    // Loading indicator
    cloneLoadingEl = document.createElement("div");
    cloneLoadingEl.className = "clone-loading";
    cloneLoadingEl.style.display = "none";
    cloneLoadingEl.textContent = "Cloning...";

    // Repo list
    repoListEl = document.createElement("div");
    repoListEl.id = "repo-list";

    content.appendChild(sheetHeader);
    content.appendChild(form);
    content.appendChild(cloneLoadingEl);
    content.appendChild(repoListEl);
    repoSheet.appendChild(backdrop);
    repoSheet.appendChild(content);
    document.body.appendChild(repoSheet);
  }

  function handleClone() {
    var url = cloneInput.value.trim();
    if (!url) return;

    cloneBtn.disabled = true;
    cloneLoadingEl.style.display = "block";

    cloneRepo(url)
      .then(function (repo) {
        cloneInput.value = "";
        refreshRepoList();
        // Auto-switch to the newly cloned repo
        return switchRepo(repo.name).then(function () {
          repoNameEl.textContent = repo.name;
          hideSheet(repoSheet);
        });
      })
      .catch(function (err) {
        alert("Clone failed: " + err.message);
      })
      .finally(function () {
        cloneBtn.disabled = false;
        cloneLoadingEl.style.display = "none";
      });
  }

  function refreshRepoList() {
    fetchRepos().then(function (repos) {
      repoListEl.innerHTML = "";
      if (repos.length === 0) {
        var empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "No repos cloned yet";
        repoListEl.appendChild(empty);
        return;
      }
      repos.forEach(function (repo) {
        var item = document.createElement("div");
        item.className = "repo-item";

        var info = document.createElement("div");
        info.className = "repo-info";
        var nameEl = document.createElement("div");
        nameEl.className = "repo-name";
        nameEl.textContent = repo.name;
        var urlEl = document.createElement("div");
        urlEl.className = "repo-url";
        urlEl.textContent = repo.url;
        info.appendChild(nameEl);
        info.appendChild(urlEl);

        var delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.textContent = "\uD83D\uDDD1"; // wastebasket emoji
        delBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (confirm("Delete " + repo.name + "?")) {
            deleteRepoApi(repo.name).then(function () {
              refreshRepoList();
              // If the deleted repo was the active one, reset the header
              if (repoNameEl.textContent === repo.name) {
                repoNameEl.textContent = "No repo";
              }
            }).catch(function (err) {
              alert("Delete failed: " + err.message);
            });
          }
        });

        item.addEventListener("click", function () {
          switchRepo(repo.name).then(function () {
            repoNameEl.textContent = repo.name;
            hideSheet(repoSheet);
          }).catch(function (err) {
            alert("Switch failed: " + err.message);
          });
        });

        item.appendChild(info);
        item.appendChild(delBtn);
        repoListEl.appendChild(item);
      });
    });
  }

  // ── Settings bottom sheet ────────────────────────────────────────
  var settingsSheet;
  var tokenStatusEl;

  function createSettingsSheet() {
    settingsSheet = document.createElement("div");
    settingsSheet.className = "bottom-sheet";

    var backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.addEventListener("click", function () { hideSheet(settingsSheet); });

    var content = document.createElement("div");
    content.className = "sheet-content";

    // Header row
    var sheetHeader = document.createElement("div");
    sheetHeader.className = "sheet-header";
    var h2 = document.createElement("h2");
    h2.textContent = "Settings";
    var closeBtn = document.createElement("button");
    closeBtn.className = "sheet-close";
    closeBtn.textContent = "\u2715"; // x mark
    closeBtn.addEventListener("click", function () { hideSheet(settingsSheet); });
    sheetHeader.appendChild(h2);
    sheetHeader.appendChild(closeBtn);

    // Token form
    var form = document.createElement("div");
    form.className = "settings-form";

    var label = document.createElement("label");
    label.textContent = "GitHub Personal Access Token";
    label.style.fontSize = "13px";
    label.style.color = "#aaa";

    var tokenInput = document.createElement("input");
    tokenInput.type = "password";
    tokenInput.placeholder = "ghp_...";

    tokenStatusEl = document.createElement("div");
    tokenStatusEl.className = "token-status";
    tokenStatusEl.textContent = "Checking...";

    var saveBtn = document.createElement("button");
    saveBtn.textContent = "Save Token";
    saveBtn.addEventListener("click", function () {
      var val = tokenInput.value.trim();
      if (!val) return;
      saveBtn.disabled = true;
      saveToken(val).then(function () {
        tokenInput.value = "";
        refreshTokenStatus();
      }).catch(function (err) {
        alert("Save failed: " + err.message);
      }).finally(function () {
        saveBtn.disabled = false;
      });
    });

    form.appendChild(label);
    form.appendChild(tokenInput);
    form.appendChild(tokenStatusEl);
    form.appendChild(saveBtn);

    content.appendChild(sheetHeader);
    content.appendChild(form);
    settingsSheet.appendChild(backdrop);
    settingsSheet.appendChild(content);
    document.body.appendChild(settingsSheet);
  }

  function refreshTokenStatus() {
    getTokenStatus().then(function (data) {
      if (data.configured) {
        tokenStatusEl.textContent = "Configured";
        tokenStatusEl.className = "token-status configured";
      } else {
        tokenStatusEl.textContent = "Not configured";
        tokenStatusEl.className = "token-status";
      }
    });
  }

  // ── Build header + sheets ────────────────────────────────────────
  createHeader();
  createRepoSheet();
  createSettingsSheet();

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
            if (initialLoad) {
              initialLoad = false;
              hideSkeleton();
            }
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
