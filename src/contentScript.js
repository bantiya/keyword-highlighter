(() => {
  if (window.__clickToHighlightWordsLoaded) {
    return;
  }
  window.__clickToHighlightWordsLoaded = true;

  const HIGHLIGHT_CLASS = "cthw-highlight";
  const BUTTON_ID = "cthw-floating-button";
  const STYLE_ID = "cthw-styles";
  const STORAGE_KEY = "cthwButtonPosition";
  const DEFAULT_WORDS = ["clearance", "citizenship", "sponsorship"];
  let currentHighlights = [];
  let activeHighlightIndex = -1;
  let panelClosed = false;
  let scanVersion = 0;
  const colorSearches = new Map();
  const SKIP_SELECTOR = [
    "script",
    "style",
    "noscript",
    "iframe",
    "textarea",
    "input",
    "select",
    "option",
    "code",
    "pre",
    `[class~='${HIGHLIGHT_CLASS}']`,
    `#${BUTTON_ID}`,
    `#${BUTTON_ID} *`
  ].join(",");

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeWords(words) {
    const source = Array.isArray(words) ? words : DEFAULT_WORDS;
    const uniqueWords = new Set();

    source.forEach((word) => {
      const normalized = String(word).trim();
      if (normalized) {
        uniqueWords.add(normalized);
      }
    });

    return [...uniqueWords];
  }

  function getStoredSettings() {
    return chrome.storage.sync
      .get(["highlightGroups", "highlightWords", "highlightColor"])
      .then(({ highlightGroups, highlightWords, highlightColor }) => {
        const groups = Array.isArray(highlightGroups) ? highlightGroups : [
          { words: normalizeWords(highlightWords), color: highlightColor }
        ];
        return groups.filter((group) => group && group.enabled !== false && Array.isArray(group.words)).map((group) => ({
          words: normalizeWords(group.words),
          color: /^#[0-9a-f]{6}$/i.test(group.color) ? group.color : "#ef4444"
        }));
      });
  }

  function getTextColor(color) {
    const channels = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16) / 255);
    const luminance = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    return luminance > 0.179 ? "#000000" : "#ffffff";
  }

  function injectStyles(color = "#ef4444") {
    const style = document.getElementById(STYLE_ID) || document.createElement("style");
    const textColor = getTextColor(color);
    style.id = STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        background: ${color} !important;
        color: ${textColor} !important;
        border-radius: 3px !important;
        box-shadow: 0 0 0 1px rgba(17, 24, 39, 0.14) !important;
        padding: 0 2px !important;
      }

      .${HIGHLIGHT_CLASS}.cthw-active-highlight {
        outline: 3px solid #111827 !important;
        outline-offset: 2px !important;
      }

      #${BUTTON_ID} {
        align-items: stretch !important;
        background: #ffffff !important;
        border: 1px solid #dbe2ec !important;
        border-radius: 14px !important;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24) !important;
        color: #375269 !important;
        cursor: grab !important;
        display: inline-flex !important;
        flex-direction: column !important;
        font: 600 13px/1.1 Arial, sans-serif !important;
        gap: 7px !important;
        min-height: 38px !important;
        left: auto;
        letter-spacing: 0 !important;
        margin: 0 !important;
        max-width: min(300px, calc(100vw - 32px)) !important;
        box-sizing: border-box !important;
        padding: 8px !important;
        position: fixed !important;
        right: 16px;
        text-align: center !important;
        top: 16px;
        user-select: none !important;
        white-space: nowrap !important;
        z-index: 2147483647 !important;
      }

      #${BUTTON_ID}:active {
        cursor: grabbing !important;
      }

      #${BUTTON_ID} .cthw-header {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      #${BUTTON_ID} .cthw-label {
        min-width: 84px !important;
        flex: 1 !important;
      }

      #${BUTTON_ID} .cthw-results {
        display: table !important;
        border-collapse: separate !important;
        border-spacing: 0 4px !important;
        width: 100% !important;
        margin: 0 !important;
        background: transparent !important;
        color: inherit !important;
        font: inherit !important;
      }

      #${BUTTON_ID} .cthw-results td {
        border: 0 !important;
        padding: 5px !important;
        vertical-align: middle !important;
        background: inherit !important;
        color: inherit !important;
      }

      #${BUTTON_ID} .cthw-results td:first-child { border-radius: 6px 0 0 6px !important; }
      #${BUTTON_ID} .cthw-results td:last-child { border-radius: 0 6px 6px 0 !important; }

      #${BUTTON_ID} .cthw-count {
        font: 600 12px/1.3 Arial, sans-serif !important;
        white-space: nowrap !important;
        min-width: 64px !important;
      }

      #${BUTTON_ID} .cthw-nav-button,
      #${BUTTON_ID} .cthw-refresh,
      #${BUTTON_ID} .cthw-close {
        align-items: center !important;
        background: rgba(255, 255, 255, 0.25) !important;
        border: 0 !important;
        border-radius: 999px !important;
        color: inherit !important;
        cursor: pointer !important;
        display: inline-flex !important;
        font: 700 14px/1 Arial, sans-serif !important;
        height: 28px !important;
        justify-content: center !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 28px !important;
      }

      #${BUTTON_ID} .cthw-nav-button:hover,
      #${BUTTON_ID} .cthw-refresh:hover,
      #${BUTTON_ID} .cthw-close:hover {
        background: rgba(0, 0, 0, 0.12) !important;
      }

      #${BUTTON_ID} .cthw-refresh,
      #${BUTTON_ID} .cthw-close { background: #edf2f8 !important; color: #375269 !important; }

      #${BUTTON_ID} .cthw-nav-button[aria-disabled="true"] {
        cursor: not-allowed !important;
        opacity: 0.45 !important;
      }
    `;
    if (!style.isConnected) {
      document.documentElement.appendChild(style);
    }
  }

  function applyPanelTransparency(button, value) {
    const transparency = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
    const alpha = 1 - transparency / 100;
    button.style.setProperty("opacity", String(alpha), "important");
    button.style.setProperty("pointer-events", alpha === 0 ? "none" : "auto", "important");
    button.inert = alpha === 0;
  }

  function restoreButtonPosition(button) {
    const savedPosition = localStorage.getItem(STORAGE_KEY);
    if (!savedPosition) {
      return;
    }

    try {
      const { edge, offset } = JSON.parse(savedPosition);
      const boundedOffset = Math.min(
        Math.max(Number(offset) || 16, 12),
        window.innerHeight - button.offsetHeight - 12
      );

      button.style.top = `${boundedOffset}px`;
      if (edge === "left") {
        button.style.left = "16px";
        button.style.right = "auto";
      } else {
        button.style.left = "auto";
        button.style.right = "16px";
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function saveButtonPosition(button) {
    const rect = button.getBoundingClientRect();
    const edge = rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right";
    const offset = Math.min(Math.max(rect.top, 12), window.innerHeight - rect.height - 12);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ edge, offset }));
  }

  function snapButtonToMargin(button) {
    const rect = button.getBoundingClientRect();
    const nextTop = Math.min(Math.max(rect.top, 12), window.innerHeight - rect.height - 12);
    const useLeft = rect.left + rect.width / 2 < window.innerWidth / 2;

    button.style.top = `${nextTop}px`;
    if (useLeft) {
      button.style.left = "16px";
      button.style.right = "auto";
    } else {
      button.style.left = "auto";
      button.style.right = "16px";
    }

    saveButtonPosition(button);
  }

  function createFloatingButton() {
    let button = document.getElementById(BUTTON_ID);
    if (button) {
      return button;
    }

    injectStyles();

    button = document.createElement("div");
    button.id = BUTTON_ID;
    button.setAttribute("role", "group");
    button.setAttribute("aria-label", "Keyword highlight results. Press Enter to scan again.");
    button.tabIndex = 0;
    button.title = "Drag to move. Click to highlight configured words again.";
    button.innerHTML = `
      <div class="cthw-header">
        <span class="cthw-label" aria-live="polite">Highlight</span>
        <button class="cthw-refresh" type="button" aria-label="Scan page again" title="Scan page again">↻</button>
        <button class="cthw-close" type="button" aria-label="Close highlight results" title="Close">×</button>
      </div>
      <table class="cthw-results" aria-label="Search results by color"><tbody class="cthw-keywords"></tbody></table>
    `;
    document.documentElement.appendChild(button);
    restoreButtonPosition(button);

    let dragStart = null;

    button.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".cthw-nav-button, .cthw-refresh, .cthw-close")) {
        return;
      }

      dragStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: button.getBoundingClientRect().left,
        top: button.getBoundingClientRect().top,
        moved: false
      };
      button.setPointerCapture(event.pointerId);
    });

    button.addEventListener("pointermove", (event) => {
      if (!dragStart) {
        return;
      }

      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
        dragStart.moved = true;
      }

      button.style.left = `${dragStart.left + deltaX}px`;
      button.style.right = "auto";
      button.style.top = `${dragStart.top + deltaY}px`;
    });

    button.addEventListener("pointerup", (event) => {
      if (!dragStart) {
        return;
      }

      const shouldClick = !dragStart.moved;
      button.releasePointerCapture(event.pointerId);
      dragStart = null;
      snapButtonToMargin(button);

      if (shouldClick) {
        runHighlight();
      }
    });

    button.addEventListener("keydown", (event) => {
      if (event.target.closest(".cthw-nav-button, .cthw-refresh, .cthw-close")) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        runHighlight();
      }
    });

    button.querySelector(".cthw-refresh").addEventListener("click", (event) => {
      event.stopPropagation();
      runHighlight();
    });

    button.querySelector(".cthw-close").addEventListener("click", (event) => {
      event.stopPropagation();
      panelClosed = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ edge: "right", offset: 16 }));
      button.style.setProperty("display", "none", "important");
    });

    return button;
  }

  function setButtonLabel(button, text) {
    const label = button.querySelector(".cthw-label");
    if (label) {
      label.textContent = text;
    }
  }

  function updateKeywordSummary(button, wordColors) {
    const summary = button.querySelector(".cthw-keywords");
    summary.replaceChildren();
    colorSearches.clear();
    wordColors.forEach((color, word) => {
      const key = color.toLowerCase();
      if (!colorSearches.has(key)) {
        colorSearches.set(key, { words: [], matches: [], index: -1 });
      }
      colorSearches.get(key).words.push(word);
    });
    currentHighlights.forEach((highlight) => {
      const color = wordColors.get(highlight.textContent.toLowerCase());
      if (color) colorSearches.get(color.toLowerCase())?.matches.push(highlight);
    });
    colorSearches.forEach((search, color) => {
      const row = document.createElement("tr");
      row.style.setProperty("background", color, "important");
      row.style.setProperty("color", getTextColor(color), "important");
      const count = document.createElement("td");
      count.className = "cthw-count";
      count.textContent = `0 / ${search.matches.length}`;
      count.setAttribute("aria-live", "polite");
      search.counter = count;
      row.appendChild(count);
      ["prev", "next"].forEach((direction) => {
        const cell = document.createElement("td");
        const nav = document.createElement("button");
        nav.type = "button";
        nav.className = "cthw-nav-button";
        nav.textContent = direction === "prev" ? "↑" : "↓";
        nav.disabled = !search.matches.length;
        nav.setAttribute("aria-disabled", String(nav.disabled));
        nav.setAttribute("aria-label", `${direction === "prev" ? "Previous" : "Next"} match for ${search.words.join(", ")}`);
        nav.addEventListener("click", (event) => {
          event.stopPropagation();
          goToHighlight(direction, color);
        });
        cell.appendChild(nav);
        row.appendChild(cell);
      });
      summary.appendChild(row);
    });
  }

  function removeExistingHighlights() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((highlight) => {
      highlight.replaceWith(document.createTextNode(highlight.textContent || ""));
    });
    document.body.normalize();
    currentHighlights = [];
    activeHighlightIndex = -1;
  }

  function shouldSkipNode(textNode) {
    const parent = textNode.parentElement;
    return !parent || parent.closest(SKIP_SELECTOR);
  }

  function collectTextNodes() {
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim() || shouldSkipNode(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    return nodes;
  }

  function highlightTextNode(textNode, pattern, wordColors) {
    const text = textNode.nodeValue;
    pattern.lastIndex = 0;
    if (!pattern.test(text)) {
      return 0;
    }

    pattern.lastIndex = 0;
    let matchCount = 0;
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();

    text.replace(pattern, (match, _word, offset) => {
      if (offset > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
      }

      const highlight = document.createElement("mark");
      highlight.className = HIGHLIGHT_CLASS;
      highlight.textContent = match;
      const color = wordColors.get(match.toLowerCase()) || "#ef4444";
      highlight.style.setProperty("background", color, "important");
      highlight.style.setProperty("color", getTextColor(color), "important");
      fragment.appendChild(highlight);
      currentHighlights.push(highlight);

      matchCount += 1;
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.replaceWith(fragment);
    return matchCount;
  }

  function goToHighlight(direction, color) {
    const search = colorSearches.get(color);
    if (!search?.matches.length) return;

    if (activeHighlightIndex >= 0) {
      currentHighlights[activeHighlightIndex]?.classList.remove("cthw-active-highlight");
    }
    const total = search.matches.length;
    search.index = direction === "prev"
      ? (search.index <= 0 ? total - 1 : search.index - 1)
      : (search.index + 1) % total;
    const activeHighlight = search.matches[search.index];
    activeHighlightIndex = currentHighlights.indexOf(activeHighlight);
    activeHighlight.classList.add("cthw-active-highlight");
    activeHighlight.scrollIntoView({ block: "center", behavior: "smooth" });
    search.counter.textContent = `${search.index + 1} / ${total}`;
  }

  function reopenPanelForScan(button) {
    if (!panelClosed) return;
    button.style.top = "16px";
    button.style.right = "16px";
    button.style.left = "auto";
    button.style.removeProperty("display");
    panelClosed = false;
  }

  async function runHighlight() {
    const version = ++scanVersion;
    const [groups, { panelTransparency, extensionEnabled }] = await Promise.all([
      getStoredSettings(),
      chrome.storage.sync.get(["panelTransparency", "extensionEnabled"])
    ]);
    if (version !== scanVersion) return;
    if (extensionEnabled === false) {
      removeExistingHighlights();
      colorSearches.clear();
      document.getElementById(BUTTON_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
      panelClosed = false;
      return;
    }
    const button = createFloatingButton();
    reopenPanelForScan(button);
    applyPanelTransparency(button, panelTransparency);
    const wordColors = new Map();
    groups.forEach(({ words, color }) => {
      words.forEach((word) => {
        const key = word.toLowerCase();
        if (!wordColors.has(key)) wordColors.set(key, color);
      });
    });
    const words = [...wordColors.keys()].sort((a, b) => b.length - a.length);
    injectStyles(groups[0]?.color);

    removeExistingHighlights();
    updateKeywordSummary(button, wordColors);

    if (!words.length) {
      button.dataset.status = "empty";
      setButtonLabel(button, "No words set");
      return;
    }

    const pattern = new RegExp(`\\b(${words.map(escapeRegExp).join("|")})\\b`, "gi");
    const totalMatches = collectTextNodes().reduce(
      (count, node) => count + highlightTextNode(node, pattern, wordColors),
      0
    );

    button.dataset.status = totalMatches ? "done" : "empty";
    setButtonLabel(button, totalMatches ? `${totalMatches} highlighted` : "No matches");
    updateKeywordSummary(button, wordColors);
    if (totalMatches) {
      const firstColor = [...colorSearches].find(([, search]) => search.matches.length)?.[0];
      goToHighlight("next", firstColor);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "HIGHLIGHT_WORDS_RUN") {
      runHighlight();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.panelTransparency) {
      const button = document.getElementById(BUTTON_ID);
      if (button) applyPanelTransparency(button, changes.panelTransparency.newValue);
    }
    if (areaName === "sync" && (changes.extensionEnabled || changes.highlightGroups || changes.highlightWords || changes.highlightColor)) {
      runHighlight();
    }
  });

  window.addEventListener("resize", () => {
    const button = document.getElementById(BUTTON_ID);
    if (button) snapButtonToMargin(button);
  });

  runHighlight();
})();
