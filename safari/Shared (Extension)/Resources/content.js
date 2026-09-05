// Copyright (c) 2025-2026 SparXion. All rights reserved.
// SparXion Chat Xport — see /legal/EULA.md

(() => {
  const BUTTON_ID = "ai-chat-save-button";
  let button;

  const UI_SKIP_PATTERNS = [
    /^(Search|Chat|Voice|Imagine|Projects|Pinned|History|Toggle Sidebar)$/i,
    /⌘[JK]/i,
    /^Toggle/i,
    /^(Home|Explore|Notifications|Messages|Bookmarks|Lists|Profile|More|Post|Articles|Creator Studio|SuperGrok|Premium\+?)$/i,
    /^(See new posts|View keyboard shortcuts|To view keyboard shortcuts.*)$/i,
    /^\d+\s+(posts?|web pages?)$/i,
    /^Download Chat\s*\(markdown\)$/i,
    /^(\d+[KMB]?)$/,
    /^(Tweet|Post|Reply|Retweet|Like|Share)$/i,
    /^(Following|Followers)$/i,
    /^@\w+$/,
  ];

  const hasVisibleStopButton = () => {
    for (const btn of document.querySelectorAll("button")) {
      const text = btn.textContent?.toLowerCase() || "";
      const ariaLabel = btn.getAttribute("aria-label")?.toLowerCase() || "";
      if (btn.offsetParent === null) continue;
      if (text.includes("stop") || ariaLabel.includes("stop")) return true;
    }
    return false;
  };

  const hasTypingIndicator = (extra = "") => {
    const selector = `[class*='typing'], [class*='loading'], [class*='streaming'], [class*='generating']${extra ? `, ${extra}` : ""}`;
    const el = document.querySelector(selector);
    return el && el.offsetParent !== null;
  };

  const cleanTitleFromPageTitle = (pageTitle, suffixPattern) => {
    if (!pageTitle) return null;
    const cleaned = pageTitle.replace(suffixPattern, "").trim();
    return cleaned.length > 3 ? cleaned : null;
  };

  const titleFromSidebar = (selectors, skipWords = []) => {
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const text = (el.textContent?.trim() || el.getAttribute("aria-label")?.trim() || "").replace(/\s+/g, " ");
        if (!text || text.length < 3 || text.length > 200) continue;
        const lower = text.toLowerCase();
        if (skipWords.some((word) => lower.includes(word))) continue;
        return text;
      }
    }
    return null;
  };

  const isPerplexityUiText = (text) =>
    /^(perplexity|answer|links|images|share|help improve|compare|reviewed \d+ sources?|ask a follow-up|download comet|model)$/i.test(
      text.trim()
    );

  const getPerplexityThreadRoot = () =>
    document.querySelector(".max-w-threadContentWidth, [class*='threadContentWidth']") ||
    document.querySelector("main") ||
    document.querySelector("#root") ||
    document.querySelector("#__next") ||
    document.body;

  const isPerplexityCometContext = () => {
    const path = window.location.pathname;
    return (
      path.includes("/sidecar") ||
      path.startsWith("/b/") ||
      /Comet/i.test(navigator.userAgent) ||
      /Perplexity/i.test(navigator.userAgent)
    );
  };

  const findPerplexityUserRoot = (el) => {
    let node = el;
    for (let depth = 0; node && node !== document.body && depth < 12; depth++) {
      if (
        node.querySelector?.(
          "button[data-testid='copy-query-button'], button[aria-label='Copy Query' i], span[data-lexical-text='true'], span.select-text, .whitespace-pre-line.text-pretty.break-words"
        )
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return el.parentElement || el;
  };

  const extractPerplexityUserText = (root) => {
    const lexicalSpans = root.querySelectorAll("span[data-lexical-text='true']");
    if (lexicalSpans.length) {
      return Array.from(lexicalSpans)
        .map((span) => span.textContent?.trim() || "")
        .filter(Boolean)
        .join(" ")
        .trim();
    }
    const selectText = root.querySelector("span.select-text");
    if (selectText) return selectText.textContent?.trim() || "";
    const pretty = root.querySelector(".whitespace-pre-line.text-pretty.break-words");
    if (pretty) return pretty.textContent?.trim() || "";
    return root.textContent?.trim() || "";
  };

  const isPerplexityAssistantNode = (node) => {
    if (node.matches("div[id^='markdown-content-'], [data-testid='answer'], [data-testid='assistant']")) {
      return true;
    }
    if (!node.matches("[class*='prose']")) return false;
    const cls = (node.className || "").toString();
    return (
      cls.includes("prose-invert") ||
      cls.includes("text-pretty") ||
      Boolean(node.closest("div[id^='markdown-content-'], .mb-md, [data-testid='search-result']"))
    );
  };

  const isLeafProseNode = (node) => {
    const nested = [...node.querySelectorAll("[class*='prose']")].filter((el) => el !== node);
    return nested.length === 0;
  };

  let toMarkdownRef = null;

  const collectPerplexityMessages = () => {
    const container = getPerplexityThreadRoot();
    const assistantSelector =
      "div[id^='markdown-content-'], [data-testid='answer'], [data-testid='assistant'], [class*='prose'][class*='prose-invert'], .prose.text-pretty";
    const userSelector =
      "h1[class*='group/query'] span.select-text, span.select-text, .whitespace-pre-line.text-pretty.break-words, span[data-lexical-text='true'], div[class*='group/query'] h1, .my-md h1";
    const combined = `${assistantSelector}, ${userSelector}`;

    const results = [];
    const seen = new Set();

    const addMessage = (author, markdown, node, top) => {
      const text = markdown.trim();
      if (text.length < 2) return;
      if (isPerplexityUiText(text) && text.length < 40) return;
      const sig = `${author}|${text.toLowerCase().replace(/\s+/g, " ").slice(0, 240)}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      results.push({
        author,
        timestamp: node?.closest?.("time[datetime]")?.getAttribute?.("datetime") || null,
        markdown: text,
        top: top ?? node?.getBoundingClientRect?.().top ?? 0,
      });
    };

    for (const node of container.querySelectorAll(combined)) {
      if (node.closest("nav, header, aside, [role='navigation'], [role='banner'], button")) continue;

      if (node.matches("div[id^='markdown-content-'], [data-testid='answer'], [data-testid='assistant']")) {
        const bubble = node.querySelector("[class*='prose']") || node;
        let markdown = "";
        try {
          markdown = toMarkdownRef(bubble);
        } catch (_) {
          markdown = bubble.textContent?.trim() || "";
        }
        addMessage("Perplexity", markdown, node);
        continue;
      }

      if (isPerplexityAssistantNode(node)) {
        if (!isLeafProseNode(node)) continue;
        let markdown = "";
        try {
          markdown = toMarkdownRef(node);
        } catch (_) {
          markdown = node.textContent?.trim() || "";
        }
        addMessage("Perplexity", markdown, node);
        continue;
      }

      const root = findPerplexityUserRoot(node);
      if (root.closest?.("[class*='prose'][class*='prose-invert'], [class*='prose-invert']")) continue;
      const text = extractPerplexityUserText(root);
      addMessage("User", text, root);
    }

    if (!results.some((message) => message.author === "User")) {
      for (const btn of container.querySelectorAll(
        "button[data-testid='copy-query-button'], button[aria-label='Copy Query' i]"
      )) {
        const root = findPerplexityUserRoot(btn);
        addMessage("User", extractPerplexityUserText(root), root);
      }
    }

    if (!results.length) {
      const hint = isPerplexityCometContext()
        ? " Comet blocks third-party extensions on perplexity.ai (same as Adobe Acrobat). Click the extension toolbar icon for console export instructions."
        : "";
      throw new Error(`Unable to locate perplexity chat messages.${hint}`);
    }

    return results
      .sort((a, b) => a.top - b.top)
      .map(({ author, timestamp, markdown }) => ({ author, timestamp, markdown }));
  };

  const X_HISTORY_MONTHS = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const isXGrokJunkTitle = (t) =>
    !t ||
    /^(grok|grok chat|x|home|explore|notifications|messages|chat|new chat|see new posts|post|more|profile|bookmarks|premium\+?|supergrok)$/i.test(
      t.trim()
    );

  /** Parse sidebar date headings like "Mar 19, 2025" / "March 19, 2025". */
  const parseXHistoryDateLabel = (text) => {
    if (!text) return null;
    const m = String(text)
      .trim()
      .match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (!m) return null;
    const month = X_HISTORY_MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (month == null) return null;
    const day = Number(m[2]);
    const year = Number(m[3]);
    const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  const extractTitleFromXHistoryNode = (node) => {
    if (!node) return null;
    const aria = (node.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    if (aria && aria.length >= 3 && aria.length <= 140 && !isXGrokJunkTitle(aria) && !parseXHistoryDateLabel(aria)) {
      // aria-label sometimes "Title, Mar 19, 2025"
      const withoutDate = aria.replace(/,?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}$/i, "").trim();
      if (withoutDate.length >= 3 && !isXGrokJunkTitle(withoutDate)) return withoutDate;
      if (!parseXHistoryDateLabel(aria)) return aria;
    }

    const lines = (node.innerText || node.textContent || "")
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    for (const line of lines) {
      if (parseXHistoryDateLabel(line)) continue;
      if (isXGrokJunkTitle(line)) continue;
      if (line.length < 3 || line.length > 140) continue;
      if (/^\d+\s+(posts?|web pages?)$/i.test(line)) continue;
      if (/see new posts|download chat|keyboard shortcuts/i.test(line)) continue;
      if (/^@\w+$/.test(line)) continue;
      return line;
    }
    return null;
  };

  const findDateNearXHistoryNode = (node) => {
    let current = node;
    for (let depth = 0; depth < 12 && current; depth++) {
      // Previous siblings often hold the date section header
      let sib = current.previousElementSibling;
      for (let i = 0; i < 8 && sib; i++) {
        const direct = parseXHistoryDateLabel((sib.textContent || "").trim().split("\n")[0]);
        if (direct) return direct;
        for (const child of sib.querySelectorAll("h1, h2, h3, h4, span, div, time")) {
          const label = (child.textContent || "").replace(/\s+/g, " ").trim();
          if (label.length > 20) continue;
          const parsed = parseXHistoryDateLabel(label);
          if (parsed) return parsed;
        }
        sib = sib.previousElementSibling;
      }

      // Parent-scoped headings
      const parent = current.parentElement;
      if (parent) {
        for (const child of parent.querySelectorAll("h1, h2, h3, h4, time, [class*='date']")) {
          if (current.contains(child)) continue;
          const label = (child.textContent || "").replace(/\s+/g, " ").trim();
          if (label.length > 20) continue;
          const parsed = parseXHistoryDateLabel(label);
          if (parsed) return parsed;
        }
      }
      current = current.parentElement;
    }
    return null;
  };

  /** Active x.com/i/grok history row → { title, dateIso }. */
  const getXGrokHistoryMeta = () => {
    if (!window.location.hostname.includes("x.com")) return { title: null, dateIso: null };

    const conversationId = new URLSearchParams(window.location.search).get("conversation");
    const candidates = [];

    const pushCandidate = (el, score) => {
      if (!el || candidates.some((c) => c.el === el)) return;
      const title = extractTitleFromXHistoryNode(el);
      if (!title) return;
      candidates.push({ el, title, score });
    };

    // 1) Link/button tied to current conversation snowflake (strongest)
    if (conversationId) {
      for (const a of document.querySelectorAll(`a[href*="conversation=${conversationId}"]`)) {
        const row = a.closest("[role='listitem'], [role='option'], li, a, button, div") || a;
        pushCandidate(row, 100);
      }
      for (const el of document.querySelectorAll(
        `[data-conversation-id="${conversationId}"], [data-testid*="${conversationId}"]`
      )) {
        const row = el.closest("[role='listitem'], [role='option'], li, a, button, div") || el;
        pushCandidate(row, 100);
      }
    }

    // 2) Explicit selected / current history rows (prefer outside main chat column)
    for (const el of document.querySelectorAll(
      '[aria-selected="true"], [aria-current="true"], [aria-current="page"], [data-selected="true"]'
    )) {
      if (el.closest("[data-testid='primaryColumn'], [data-testid='grok-conversation']")) continue;
      const row = el.closest("[role='listitem'], [role='option'], li, a, button, div") || el;
      pushCandidate(row, 80);
    }

    // 3) Active/highlighted conversation classes in sidebars
    for (const el of document.querySelectorAll(
      'aside [class*="active"], nav [class*="active"], [class*="conversation"][class*="active"], [class*="history"][class*="active"]'
    )) {
      pushCandidate(el, 60);
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) return { title: null, dateIso: null };

    return {
      title: best.title,
      dateIso: findDateNearXHistoryNode(best.el),
    };
  };

  const getXGrokRoot = () =>
    document.querySelector("[data-testid='grok-conversation']") ||
    document.querySelector("[aria-label='Grok']") ||
    document.querySelector("[data-testid='primaryColumn']") ||
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.body;

  const collectXGrokMessagesFromDom = () => {
    const root = getXGrokRoot();
    const selectorList = [
      "[data-testid='user-message']",
      "[data-testid='grokResponse']",
      "[data-testid='grok-response']",
      "[data-testid='assistant-message']",
      "[data-testid='messageEntry']",
      "[data-testid='chat-message']",
      "div.message-bubble",
      "article[data-testid^='message-']",
      "[data-testid*='message-bubble']",
    ];
    const seen = new Set();
    const nodes = [];

    for (const selector of selectorList) {
      for (const node of root.querySelectorAll(selector)) {
        if (seen.has(node)) continue;
        if (node.closest("nav, aside, [data-testid='sidebarColumn'], [data-testid='grokInput']")) continue;
        if (node.matches("button, textarea, input, [contenteditable='true']")) continue;

        let isDescendant = false;
        for (const selected of nodes) {
          if (selected !== node && selected.contains(node)) {
            isDescendant = true;
            break;
          }
        }
        if (isDescendant) continue;
        for (let i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i] !== node && node.contains(nodes[i])) nodes.splice(i, 1);
        }

        const text = node.textContent?.trim() || "";
        if (text.length < 5) continue;
        if (/^\d+\s+(posts?|web pages?)$/i.test(text)) continue;
        if (UI_SKIP_PATTERNS.some((pattern) => pattern.test(text))) continue;

        seen.add(node);
        nodes.push(node);
      }
    }

    nodes.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    return nodes.map((node, index) => {
      const testId = (node.getAttribute("data-testid") || "").toLowerCase();
      let author = null;
      if (testId.includes("user")) author = "User";
      else if (testId.includes("grok") || testId.includes("assistant") || testId.includes("response")) author = "Grok";
      if (!author) {
        const classes = (node.className || "").toString().toLowerCase();
        const parentClasses = (node.parentElement?.className || "").toString().toLowerCase();
        const combined = `${classes} ${parentClasses}`;
        if (combined.includes("items-end") && !combined.includes("items-start")) author = "User";
        else if (combined.includes("items-start") && !combined.includes("items-end")) author = "Grok";
      }
      if (!author) author = index % 2 === 0 ? "User" : "Grok";

      let markdown = "";
      try {
        markdown = toMarkdownRef ? toMarkdownRef(node) : node.textContent?.trim() || "";
      } catch (_) {
        markdown = node.textContent?.trim() || "";
      }
      markdown = markdown.replace(/^(Auto)?See new posts\s*/i, "").trim();
      return { author, timestamp: null, markdown };
    });
  };

  const collectXGrokMessagesFromText = () => {
    const root = getXGrokRoot();
    const clone = root.cloneNode(true);
    clone
      .querySelectorAll(
        "nav, header, aside, footer, [role='navigation'], [role='banner'], [data-testid='sidebarColumn'], [data-testid='grokInput'], [data-testid='grokSendButton'], textarea, input, [contenteditable='true'], script, style, #ai-chat-save-button"
      )
      .forEach((el) => el.remove());

    // Prefer block-aware text so turns aren't one flat string
    const blockEls = clone.querySelectorAll(
      "[data-testid='user-message'], [data-testid='grokResponse'], [data-testid='grok-response'], [data-testid='assistant-message'], [data-testid='messageEntry'], div.message-bubble, [role='article']"
    );
    let text = "";
    if (blockEls.length >= 2) {
      text = Array.from(blockEls)
        .map((el) => (el.innerText || el.textContent || "").trim())
        .filter((t) => t.length >= 5)
        .join("\n\n");
    }
    if (text.length < 40) {
      text = (clone.innerText || clone.textContent || "").trim();
    }
    if (text.length < 40) return [];

    const normalizeFn =
      (typeof globalThis !== "undefined" && typeof globalThis.__SPARXION_NORMALIZE_X_GROK_PASTE__ === "function"
        ? globalThis.__SPARXION_NORMALIZE_X_GROK_PASTE__
        : null) ||
      (typeof globalThis !== "undefined" &&
      globalThis.SparXionNormalizeXGrokPaste &&
      typeof globalThis.SparXionNormalizeXGrokPaste.normalizeXGrokPaste === "function"
        ? globalThis.SparXionNormalizeXGrokPaste.normalizeXGrokPaste
        : null);

    if (!normalizeFn) {
      console.warn("[SparXion Chat Xport] x.com text fallback: normalizeXGrokPaste not loaded");
      return [];
    }

    const pageTitle = document.querySelector("title")?.textContent || "";
    const title = pageTitle.replace(/\s*(\/|\||-)\s*(X|Grok).*$/i, "").trim();
    const created = (() => {
      try {
        const conversationId = new URLSearchParams(window.location.search).get("conversation");
        if (!conversationId) return undefined;
        const timestamp = Number(BigInt(conversationId) >> 22n) + 1288834974657;
        const date = new Date(timestamp);
        return !isNaN(date.getTime()) ? date.toISOString() : undefined;
      } catch (_) {
        return undefined;
      }
    })();

    const result = normalizeFn(text, {
      url: window.location.href,
      title: title && !/^(grok|grok chat)$/i.test(title) ? title : undefined,
      created,
    });
    return (result.messages || []).map(({ author, markdown }) => ({
      author,
      timestamp: null,
      markdown,
    }));
  };

  const xGrokDomLooksMashed = (messages) => {
    if (!messages?.length) return true;
    if (messages.length <= 3 && messages.some((m) => (m.markdown || "").length > 8000)) return true;
    // User turn that clearly contains a Grok reply opener → bad scrape
    return messages.some(
      (m) =>
        m.author === "User" &&
        (m.markdown || "").length > 400 &&
        /(?:Reinventing yourself|I hear you|That(?:'s|’s) an awesome|Absolutely, I’d love|Yes, you can absolutely)/i.test(
          m.markdown
        )
    );
  };

  /** x.com-only collector; returns null on grok.com so default DOM path runs. */
  const collectGrokMessages = () => {
    if (!window.location.hostname.includes("x.com")) return null;

    const fromDom = collectXGrokMessagesFromDom().filter((m) => (m.markdown || "").trim().length >= 10);
    const fromText = collectXGrokMessagesFromText();

    // Prefer structured text normalizer when DOM returned a mashed mega-blob
    if (fromText.length >= 4 && (xGrokDomLooksMashed(fromDom) || fromText.length > fromDom.length * 2)) {
      return fromText;
    }
    if (fromDom.length >= 2 && !xGrokDomLooksMashed(fromDom)) return fromDom;
    if (fromText.length) return fromText;
    if (fromDom.length) return fromDom;
    return [];
  };

  const SITE_ADAPTERS = {
    grok: {
      hostnames: ["grok.com", "x.com"],
      assistantName: "Grok",
      scrollContainer: () => {
        const onXGrok = window.location.hostname.includes("x.com");
        if (onXGrok) {
          return (
            document.querySelector("[data-testid='grok-conversation'], [data-testid='conversation-scroll-container']") ||
            document.querySelector("main [class*='overflow'], main [style*='overflow']") ||
            document.querySelector("main") ||
            document.querySelector("[role='main']")
          );
        }
        return (
          document.querySelector("[data-testid='conversation-scroll-container']") ||
          document.querySelector("[data-testid*='conversation']") ||
          document.querySelector("[class*='conversation']") ||
          document.querySelector("main") ||
          document.querySelector("[role='main']")
        );
      },
      messageSelectors: [
        "[data-testid='user-message']",
        "[data-testid='grokResponse']",
        "[data-testid='grok-response']",
        "[data-testid='assistant-message']",
        "[data-testid='messageEntry']",
        "div.message-bubble",
        "[data-testid='chat-message']",
        "article[data-testid^='message-']",
        "[data-testid='message']",
        "[data-testid*='message-bubble']",
        "[role='article']",
        ".conversation-message",
        "[data-testid*='message']",
        "main [class*='markdown']",
        "main [class*='prose']",
        "main [class*='response']",
      ],
      countSelector:
        "[data-testid='user-message'], [data-testid='grokResponse'], [data-testid='grok-response'], [data-testid='assistant-message'], div.message-bubble, [data-testid='chat-message'], [data-testid*='message'], [role='article']",
      isStreaming: () =>
        hasVisibleStopButton() ||
        hasTypingIndicator() ||
        Boolean(document.querySelector("[data-testid='grokLoading']")),
      collectMessagesCustom: collectGrokMessages,
      shouldSkipNode(node, text) {
        // Extra chrome filtering is for x.com/i/grok; grok.com uses shared UI_SKIP_PATTERNS via dedupe
        const onX = window.location.hostname.includes("x.com");
        if (!onX) return false;
        if (node.closest("nav, footer, aside, [role='navigation'], [data-testid='sidebarColumn']")) {
          return true;
        }
        // Only skip the control itself — X wraps chat content in interactive ancestors
        if (node.matches("button, a[role='button'], [role='button'], textarea, input")) return true;
        if (
          !node.closest(
            "main, [role='main'], [data-testid='grok-conversation'], [data-testid='primaryColumn'], [aria-label='Grok']"
          )
        ) {
          return true;
        }
        const rect = node.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 10) return true;
        const cleaned = (text || "").replace(/^(Auto)?See new posts\s*/i, "").trim();
        if (/^\d+\s+(posts?|web pages?)$/i.test(cleaned)) return true;
        if (/^Download Chat\s*\(markdown\)$/i.test(cleaned)) return true;
        return UI_SKIP_PATTERNS.some((pattern) => pattern.test(cleaned));
      },
      getBubble(node) {
        if (node.matches("div.message-bubble") || node.textContent?.trim().length >= 5) return node;
        return node.querySelector("div.message-bubble, [class*='markdown'], [class*='prose']") || node;
      },
      getWrapper(node) {
        return (
          node.closest("div.group") ||
          node.closest("[data-author]") ||
          node.closest("[data-testid*='message']") ||
          node.closest("[role='group']") ||
          node.closest("[role='article']") ||
          node.parentElement ||
          node
        );
      },
      detectAuthor(node, wrapper) {
        let author = wrapper?.getAttribute?.("data-author") || node?.getAttribute?.("data-author") || "";
        let isUser = false;
        let isAssistant = false;
        if (author) {
          const lower = author.toLowerCase();
          if (lower.includes("user") || lower.includes("human")) isUser = true;
          else if (lower.includes("grok") || lower.includes("assistant")) isAssistant = true;
        }
        const testId = `${wrapper?.getAttribute?.("data-testid") || ""} ${node?.getAttribute?.("data-testid") || ""}`.toLowerCase();
        if (testId.includes("user")) isUser = true;
        if (testId.includes("assistant") || testId.includes("grok")) isAssistant = true;

        if (!isUser && !isAssistant) {
          for (const elem of [node, node.parentElement, node.parentElement?.parentElement, wrapper].filter(Boolean)) {
            const classes = (elem.className || "").toLowerCase();
            if (classes.includes("items-end") && !classes.includes("items-start")) {
              isUser = true;
              break;
            }
            if (classes.includes("items-start") && !classes.includes("items-end")) {
              isAssistant = true;
              break;
            }
          }
        }
        const allClasses = `${wrapper?.className ?? ""} ${node?.className ?? ""}`.toLowerCase();
        if (!isUser && (allClasses.includes("user") || allClasses.includes("human"))) isUser = true;
        if (!isAssistant && (allClasses.includes("assistant") || allClasses.includes("grok") || allClasses.includes("markdown") || allClasses.includes("prose"))) {
          // markdown/prose alone is weak — only treat as assistant when not clearly user-aligned
          if (allClasses.includes("assistant") || allClasses.includes("grok")) isAssistant = true;
          else if (!isUser && (allClasses.includes("markdown") || allClasses.includes("prose")) && allClasses.includes("items-start")) {
            isAssistant = true;
          }
        }
        return { author: isAssistant ? "Grok" : isUser ? "User" : null, isUser, isAssistant };
      },
      resolveAuthor(result, index) {
        if (result.author) return result.author;
        return index % 2 === 0 ? "User" : "Grok";
      },
      getTitle() {
        // Prefer x.com history-list title (e.g. "Reinventing Creative Professionals")
        const history = getXGrokHistoryMeta();
        if (history.title && !isXGrokJunkTitle(history.title)) return history.title;

        const suffix = /\s*(\/|\||-)\s*(X|Grok).*$/i;
        const fromTitle = cleanTitleFromPageTitle(document.querySelector("title")?.textContent, suffix);
        if (fromTitle && !isXGrokJunkTitle(fromTitle)) return fromTitle;

        const xTitleSelectors = [
          "[data-testid='grok-conversation-title']",
          "[data-testid*='conversation'][data-testid*='title']",
          "[data-testid='conversation-title']",
          "main h1",
          "main h2",
        ];
        for (const selector of xTitleSelectors) {
          try {
            for (const el of document.querySelectorAll(selector)) {
              const text = (el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
              if (text.length < 3 || text.length > 140) continue;
              if (isXGrokJunkTitle(text)) continue;
              if (/see new posts|download chat|keyboard shortcuts/i.test(text)) continue;
              return text;
            }
          } catch (_) {
            /* ignore */
          }
        }

        return (
          titleFromSidebar(
            ["[class*='conversation'][class*='active']", "[aria-current='page']", "[aria-selected='true']"],
            ["grok", "x.com", "see new posts", "new chat", "home", "explore"]
          ) || null
        );
      },
      getDate() {
        if (!window.location.hostname.includes("x.com")) return null;

        // Prefer the history sidebar date sitting with the active chat (matches x.com history UI)
        const history = getXGrokHistoryMeta();
        if (history.dateIso) return history.dateIso;

        const conversationId = new URLSearchParams(window.location.search).get("conversation");
        if (conversationId) {
          try {
            const timestamp = Number(BigInt(conversationId) >> 22n) + 1288834974657;
            const date = new Date(timestamp);
            if (!isNaN(date.getTime()) && date.getTime() >= new Date("2020-01-01").getTime()) {
              return date.toISOString();
            }
          } catch (_) {
            /* ignore */
          }
        }
        const timeEl = document.querySelector("time[datetime]");
        return timeEl?.getAttribute("datetime") || null;
      },
      // x.com filenames: CreatedDate-chatname-DownloadDate (no grok-x prefix)
      filenamePrefix: () => (window.location.hostname.includes("x.com") ? "" : "grok"),
      beforeCollect: () => waitForGrokContent(),
      postProcessMarkdown(markdown) {
        return markdown
          .replace(/^(Auto)?See new posts\s*/i, "")
          .replace(/^\d+\s+(posts?|web pages?)\s*$/gim, "")
          .trim();
      },
    },

    claude: {
      hostnames: ["claude.ai"],
      assistantName: "Claude",
      scrollContainer: () =>
        document.querySelector("[data-conversation-scroll-container]") ||
        document.querySelector("main") ||
        document.querySelector("[class*='overflow']"),
      messageSelectors: [
        "[data-testid='user-message']",
        "[class*='font-claude-response']",
      ],
      countSelector: "[data-testid='user-message'], [class*='font-claude-response']",
      isStreaming: () => {
        if (hasVisibleStopButton()) return true;
        const typing = document.querySelector("[class*='typing-indicator'], [class*='TypingIndicator']");
        return typing && typing.offsetParent !== null;
      },
      getBubble(node) {
        if (node.matches("[data-testid='user-message']")) return node;
        return node.querySelector("[class*='standard-markdown'], [class*='progressive-markdown']") || node;
      },
      getWrapper(node) {
        return node.closest("div.group") || node.parentElement || node;
      },
      detectAuthor(node) {
        if (node.matches("[data-testid='user-message']")) {
          return { author: "User", isUser: true, isAssistant: false };
        }
        if (node.matches("[class*='font-claude-response']") || node.querySelector("[class*='font-claude-response']")) {
          return { author: "Claude", isUser: false, isAssistant: true };
        }
        if (node.querySelector("[class*='standard-markdown'], [class*='progressive-markdown']")) {
          return { author: "Claude", isUser: false, isAssistant: true };
        }
        let current = node;
        for (let i = 0; i < 8 && current; i++) {
          const classes = (current.className || "").toLowerCase();
          if (classes.includes("font-claude-response")) {
            return { author: "Claude", isUser: false, isAssistant: true };
          }
          if (classes.includes("font-user-message") || current.getAttribute("data-testid") === "user-message") {
            return { author: "User", isUser: true, isAssistant: false };
          }
          current = current.parentElement;
        }
        for (const elem of [node, node.parentElement].filter(Boolean)) {
          const classes = (elem.className || "").toLowerCase();
          if (classes.includes("items-end") && !classes.includes("items-start")) {
            return { author: "User", isUser: true, isAssistant: false };
          }
          if (classes.includes("items-start") && !classes.includes("items-end")) {
            return { author: "Claude", isUser: false, isAssistant: true };
          }
        }
        return { author: null, isUser: false, isAssistant: false };
      },
      resolveAuthor(result, index) {
        if (result.author) return result.author;
        return index % 2 === 0 ? "User" : "Claude";
      },
      getTitle() {
        const fromTitle = cleanTitleFromPageTitle(document.querySelector("title")?.textContent, /\s*(\||-)\s*Claude.*$/i);
        if (fromTitle && fromTitle.toLowerCase() !== "claude") return fromTitle;
        return titleFromSidebar(["[class*='chat-title']", "[data-testid*='chat-title']"], ["claude"]) || null;
      },
    },

    perplexity: {
      hostnames: ["perplexity.ai"],
      assistantName: "Perplexity",
      scrollContainer: () => {
        const thread =
          document.querySelector(".max-w-threadContentWidth, [class*='threadContentWidth']") ||
          document.querySelector("main") ||
          document.querySelector("#root") ||
          document.body;
        let node = thread;
        while (node && node !== document.body) {
          const style = window.getComputedStyle(node);
          const overflowY = (style.overflowY || style.overflow || "").toLowerCase();
          if (/auto|scroll|overlay/.test(overflowY) && node.scrollHeight - node.clientHeight > 50) {
            return node;
          }
          node = node.parentElement;
        }
        return thread;
      },
      messageSelectors: [],
      countSelector:
        "span.select-text, span[data-lexical-text='true'], div[id^='markdown-content-'], [class*='prose'][class*='prose-invert']",
      isStreaming: () => hasVisibleStopButton() || hasTypingIndicator(),
      collectMessagesCustom: collectPerplexityMessages,
      minMarkdownLength: 2,
      getTitle() {
        const fromTitle = cleanTitleFromPageTitle(document.querySelector("title")?.textContent, /\s*(\||-)\s*Perplexity.*$/i);
        if (fromTitle && fromTitle.toLowerCase() !== "perplexity") return fromTitle;

        const root = getPerplexityThreadRoot();
        const firstQuery = root.querySelector(
          "div[class*='group/query'] span.select-text, div[class*='group/query'] h1, span.select-text, span[data-lexical-text='true'], .my-md h1, .whitespace-pre-line.text-pretty.break-words"
        );
        const queryText = firstQuery?.textContent?.trim();
        if (queryText && queryText.length > 3 && queryText.length < 120 && !isPerplexityUiText(queryText)) {
          return queryText;
        }

        return titleFromSidebar(["[aria-current='page']", "[aria-selected='true']", "a[class*='active']"], ["perplexity", "new thread"]) || null;
      },
    },

    chatgpt: {
      hostnames: ["chatgpt.com", "chat.openai.com"],
      assistantName: "ChatGPT",
      scrollContainer: () =>
        document.querySelector("main") ||
        document.querySelector("[class*='react-scroll-to-bottom']") ||
        document.querySelector("[role='main']"),
      messageSelectors: ["[data-message-author-role]", "[data-message-id]"],
      countSelector: "[data-message-author-role], [data-message-id]",
      isStreaming: () => hasVisibleStopButton() || hasTypingIndicator("[class*='result-streaming']"),
      getBubble(node) {
        return (
          node.querySelector("[data-message-content]") ||
          node.querySelector(".markdown, [class*='markdown']") ||
          node.querySelector("[class*='prose']") ||
          node
        );
      },
      getWrapper(node) {
        return node.closest("[data-message-author-role]") || node.closest("[data-message-id]") || node;
      },
      detectAuthor(node, wrapper) {
        const role =
          node.getAttribute("data-message-author-role") ||
          wrapper?.getAttribute("data-message-author-role") ||
          node.closest("[data-message-author-role]")?.getAttribute("data-message-author-role");
        if (role === "user") return { author: "User", isUser: true, isAssistant: false };
        if (role === "assistant") return { author: "ChatGPT", isUser: false, isAssistant: true };
        return { author: null, isUser: false, isAssistant: false };
      },
      resolveAuthor(result, index) {
        if (result.author) return result.author;
        return index % 2 === 0 ? "User" : "ChatGPT";
      },
      getTitle() {
        const fromTitle = cleanTitleFromPageTitle(document.querySelector("title")?.textContent, /\s*(\||-)\s*ChatGPT.*$/i);
        if (fromTitle && !/^(chatgpt|new chat)$/i.test(fromTitle)) return fromTitle;
        const h1 = document.querySelector("nav h1, header h1, [data-testid*='conversation-title'], h1");
        const text = h1?.textContent?.trim();
        if (text && text.length > 1 && text.length < 200 && !/^chatgpt$/i.test(text)) return text;
        return null;
      },
    },

    gemini: {
      hostnames: ["gemini.google.com", "bard.google.com"],
      assistantName: "Gemini",
      scrollContainer: () =>
        document.querySelector(".chat-history-scroll-container") ||
        document.querySelector("chat-window-content") ||
        document.querySelector(".conversation-container") ||
        document.querySelector("main"),
      messageSelectors: [
        "user-query",
        "model-response",
        ".user-query-bubble-container",
        ".model-response-text",
        "[data-message-author-role='user']",
        "[data-message-author-role='model']",
        "div[aria-label='User message']",
        "div[aria-label='Gemini response']",
      ],
      countSelector: "user-query, model-response, [data-message-author-role]",
      isStreaming: () => hasVisibleStopButton() || hasTypingIndicator(),
      getBubble(node) {
        if (node.matches("user-query, model-response")) {
          return node.querySelector(".markdown, [class*='markdown'], .response-content, message-content") || node;
        }
        return node.querySelector(".markdown, [class*='markdown'], .query-text, .response-content") || node;
      },
      getWrapper(node) {
        return node.closest("user-query, model-response, .conversation-turn") || node;
      },
      detectAuthor(node) {
        if (node.matches("user-query, .user-query-bubble-container, [data-message-author-role='user'], div[aria-label='User message']")) {
          return { author: "User", isUser: true, isAssistant: false };
        }
        if (node.matches("model-response, .model-response-text, [data-message-author-role='model'], div[aria-label='Gemini response']")) {
          return { author: "Gemini", isUser: false, isAssistant: true };
        }
        const label = node.getAttribute("aria-label")?.toLowerCase() || "";
        if (label.includes("user")) return { author: "User", isUser: true, isAssistant: false };
        if (label.includes("gemini") || label.includes("model")) {
          return { author: "Gemini", isUser: false, isAssistant: true };
        }
        return { author: null, isUser: false, isAssistant: false };
      },
      resolveAuthor(result, index) {
        if (result.author) return result.author;
        return index % 2 === 0 ? "User" : "Gemini";
      },
      getTitle() {
        const fromTitle = cleanTitleFromPageTitle(document.querySelector("title")?.textContent, /\s*(\||-)\s*Gemini.*$/i);
        if (fromTitle && !/^gemini$/i.test(fromTitle)) return fromTitle;
        const selected = document.querySelector("[aria-selected='true'], [aria-current='true']");
        const text = selected?.textContent?.trim();
        if (text && text.length > 1 && text.length < 200) return text;
        return null;
      },
    },

    metaai: {
      hostnames: ["meta.ai"],
      assistantName: "Meta AI",
      scrollContainer: () =>
        document.querySelector("main") ||
        document.querySelector("[class*='chat']") ||
        document.querySelector("[role='main']"),
      messageSelectors: [
        "[data-testid*='message']",
        "[class*='MessageBubble']",
        "[class*='message-bubble']",
        "[role='article']",
        "div[class*='message']",
      ],
      countSelector: "[data-testid*='message'], [class*='MessageBubble'], [role='article']",
      isStreaming: () => hasVisibleStopButton() || hasTypingIndicator(),
      getBubble(node) {
        return node.querySelector("[class*='markdown'], [class*='prose'], [class*='content']") || node;
      },
      getWrapper(node) {
        return node.closest("[data-testid*='message'], [class*='MessageBubble'], [role='article']") || node;
      },
      detectAuthor(node, wrapper) {
        const testId = (wrapper?.getAttribute("data-testid") || node.getAttribute("data-testid") || "").toLowerCase();
        if (testId.includes("user") || testId.includes("human")) {
          return { author: "User", isUser: true, isAssistant: false };
        }
        if (testId.includes("assistant") || testId.includes("meta")) {
          return { author: "Meta AI", isUser: false, isAssistant: true };
        }
        for (const elem of [node, wrapper, node.parentElement].filter(Boolean)) {
          const classes = (elem.className || "").toLowerCase();
          if (classes.includes("user") && !classes.includes("assistant")) {
            return { author: "User", isUser: true, isAssistant: false };
          }
          if (classes.includes("assistant") || classes.includes("bot")) {
            return { author: "Meta AI", isUser: false, isAssistant: true };
          }
          if (classes.includes("items-end") && !classes.includes("items-start")) {
            return { author: "User", isUser: true, isAssistant: false };
          }
          if (classes.includes("items-start") && !classes.includes("items-end")) {
            return { author: "Meta AI", isUser: false, isAssistant: true };
          }
        }
        return { author: null, isUser: false, isAssistant: false };
      },
      resolveAuthor(result, index) {
        if (result.author) return result.author;
        return index % 2 === 0 ? "User" : "Meta AI";
      },
      getTitle() {
        const fromTitle = cleanTitleFromPageTitle(document.querySelector("title")?.textContent, /\s*(\||-)\s*Meta AI.*$/i);
        if (fromTitle && !/^meta ai$/i.test(fromTitle)) return fromTitle;
        const h = document.querySelector("h1, h2, [class*='title']");
        const text = h?.textContent?.trim();
        if (text && text.length > 1 && text.length < 200 && !/^meta ai$/i.test(text)) return text;
        return null;
      },
    },

    mistral: {
      hostnames: ["chat.mistral.ai", "lechat.mistral.ai"],
      assistantName: "Mistral",
      scrollContainer: () =>
        document.querySelector("main") ||
        document.querySelector("[class*='chat']") ||
        document.querySelector("[class*='conversation']") ||
        document.querySelector("[class*='overflow']"),
      messageSelectors: [
        "[data-testid*='message']",
        "[class*='MessageRow']",
        "[class*='message-row']",
        "div[class*='message']",
        ".prose",
      ],
      countSelector: "[data-testid*='message'], [class*='MessageRow'], [class*='message-row']",
      isStreaming: () => hasVisibleStopButton() || hasTypingIndicator(),
      shouldSkipNode(node) {
        if (node.matches(".prose") && !node.closest("[class*='message'], [data-testid*='message']")) return true;
        return false;
      },
      getBubble(node) {
        return node.querySelector(".prose, [class*='markdown'], [class*='message-content']") || node;
      },
      getWrapper(node) {
        return node.closest("[data-testid*='message'], [class*='MessageRow'], [class*='message-row']") || node;
      },
      detectAuthor(node, wrapper) {
        const role = node.getAttribute("data-author") || wrapper?.getAttribute("data-author") || "";
        if (/user|human/i.test(role)) return { author: "User", isUser: true, isAssistant: false };
        if (/assistant|mistral|vibe/i.test(role)) {
          return { author: "Mistral", isUser: false, isAssistant: true };
        }
        for (const elem of [node, wrapper, node.parentElement].filter(Boolean)) {
          const classes = (elem.className || "").toLowerCase();
          const testId = (elem.getAttribute("data-testid") || "").toLowerCase();
          if (testId.includes("user") || classes.includes("user-message")) {
            return { author: "User", isUser: true, isAssistant: false };
          }
          if (testId.includes("assistant") || classes.includes("assistant-message")) {
            return { author: "Mistral", isUser: false, isAssistant: true };
          }
          if (classes.includes("items-end") && !classes.includes("items-start")) {
            return { author: "User", isUser: true, isAssistant: false };
          }
          if (classes.includes("items-start") && !classes.includes("items-end")) {
            return { author: "Mistral", isUser: false, isAssistant: true };
          }
        }
        return { author: null, isUser: false, isAssistant: false };
      },
      resolveAuthor(result, index) {
        if (result.author) return result.author;
        return index % 2 === 0 ? "User" : "Mistral";
      },
      getTitle() {
        const fromTitle = cleanTitleFromPageTitle(
          document.querySelector("title")?.textContent,
          /\s*(\||-)\s*(Mistral|Vibe|Le Chat).*$/i
        );
        if (fromTitle && !/^(mistral|vibe|le chat)$/i.test(fromTitle)) return fromTitle;
        return titleFromSidebar(["[aria-selected='true']", "[aria-current='page']"], ["mistral", "vibe", "new chat"]) || null;
      },
    },
  };

  const getSiteType = () => {
    const hostname = window.location.hostname.toLowerCase();
    for (const [key, adapter] of Object.entries(SITE_ADAPTERS)) {
      if (adapter.hostnames.some((h) => hostname.includes(h))) return key;
    }
    return "unknown";
  };

  const getAdapter = () => SITE_ADAPTERS[getSiteType()] || null;

  const ensureButton = () => {
    if (document.getElementById(BUTTON_ID)) return;

    button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.setAttribute("aria-label", "Download chat (Markdown)");

    const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    iconSvg.setAttribute("width", "20");
    iconSvg.setAttribute("height", "20");
    iconSvg.setAttribute("viewBox", "0 0 24 24");
    iconSvg.setAttribute("fill", "none");
    iconSvg.setAttribute("stroke", "currentColor");
    iconSvg.setAttribute("stroke-width", "2");
    iconSvg.setAttribute("stroke-linecap", "round");
    iconSvg.setAttribute("stroke-linejoin", "round");
    iconSvg.style.display = "block";
    iconSvg.style.flexShrink = "0";

    const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path1.setAttribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4");
    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    path2.setAttribute("points", "7 10 12 15 17 10");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "12");
    line.setAttribute("y1", "15");
    line.setAttribute("x2", "12");
    line.setAttribute("y2", "3");

    iconSvg.appendChild(path1);
    iconSvg.appendChild(path2);
    iconSvg.appendChild(line);

    const textSpan = document.createElement("span");
    textSpan.className = "button-text";
    textSpan.textContent = "Download Chat (markdown)";

    button.appendChild(iconSvg);
    button.appendChild(textSpan);
    button.addEventListener("click", handleDownloadClick);

    document.body.appendChild(button);
  };

  const titleFromFirstUserMessage = (messages) => {
    if (!messages?.length) return null;
    const firstMessage = messages.find((m) => m.author && m.author.toLowerCase().includes("user"));
    if (!firstMessage?.markdown) return null;
    const text = firstMessage.markdown.trim();
    const firstSentence = text.split(/[.!?\n]/)[0].trim();
    const titleText = firstSentence.length > 10 && firstSentence.length < 80 ? firstSentence : text.substring(0, 80).trim();
    const cleaned = titleText.replace(/\*\*/g, "").replace(/#{1,6}\s+/g, "").trim();
    const lowerCleaned = cleaned.toLowerCase();
    if (cleaned.length > 10 && cleaned.length < 100 && !lowerCleaned.match(/^\d+\./)) {
      return cleaned;
    }
    return null;
  };

  const resolveChatTitle = (messages) => {
    const siteType = getSiteType();
    let title = getChatTitle();
    const isGeneric =
      !title ||
      title === `${siteType}-chat` ||
      /^(grok|grok chat|grok conversation)$/i.test(title.trim());

    if (isGeneric) {
      const fromMessage = titleFromFirstUserMessage(messages);
      if (fromMessage) title = fromMessage;
    }
    return title;
  };

  const handleDownloadClick = async () => {
    button.disabled = true;
    const textSpan = button.querySelector(".button-text");
    if (textSpan) textSpan.textContent = "Collecting…";

    try {
      const adapter = getAdapter();
      if (!adapter) throw new Error("Unsupported site.");

      if (adapter.beforeCollect) await adapter.beforeCollect();

      await autoloadFullHistory();
      const messages = collectMessages();

      const siteType = getSiteType();
      const title = resolveChatTitle(messages);
      const chatDate = getChatDate();

      const markdown = buildMarkdown(messages, { title, chatDate });

      const now = new Date();
      const downloadDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      // Preferred: CreatedDate-chatname-DownloadDate.md (x.com / when creation date known)
      const nameParts = [];
      const prefix = typeof adapter.filenamePrefix === "function" ? adapter.filenamePrefix() : adapter.filenamePrefix;
      if (prefix) nameParts.push(prefix);
      if (chatDate) {
        const dateObj = new Date(chatDate);
        nameParts.push(
          `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}${String(dateObj.getDate()).padStart(2, "0")}`
        );
      }
      if (title && title !== `${siteType}-chat`) {
        nameParts.push(slugify(title));
      }
      nameParts.push(downloadDateStr);

      const fileName = nameParts.filter(Boolean).join("-") + ".md";
      await triggerDownload(markdown, fileName);

      if (textSpan) textSpan.textContent = "Download complete!";
      setTimeout(() => {
        if (textSpan) textSpan.textContent = "Download Chat (markdown)";
        button.disabled = false;
      }, 2200);
    } catch (error) {
      console.error("[SparXion Chat Xport]", error);
      alert(`SparXion Chat Xport\n\n${error.message ?? error}`);
      if (textSpan) textSpan.textContent = "Download Chat (markdown)";
      button.disabled = false;
    }
  };

  const isChatPage = () => getSiteType() !== "unknown";

  const isStreaming = () => {
    const adapter = getAdapter();
    return adapter?.isStreaming?.() || false;
  };

  const waitForStreamingToComplete = async () => {
    let consecutiveStableChecks = 0;
    const requiredStableChecks = 3;
    let lastMessageText = "";
    let lastMessageTextCheckCount = 0;
    const maxWaitTime = 10000;
    const startTime = Date.now();
    const adapter = getAdapter();
    const countSelector = adapter?.countSelector || "[class*='message']";

    while (consecutiveStableChecks < requiredStableChecks && Date.now() - startTime < maxWaitTime) {
      const currentlyStreaming = isStreaming();
      const messages = document.querySelectorAll(countSelector);
      let textChanged = false;

      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const currentText = lastMessage.textContent?.trim() || "";
        if (currentText.length > 10) {
          if (lastMessageText !== currentText) {
            textChanged = true;
            lastMessageText = currentText;
            lastMessageTextCheckCount = 0;
          } else {
            lastMessageTextCheckCount += 1;
          }
        }
      }

      if (currentlyStreaming || textChanged) {
        consecutiveStableChecks = 0;
        await delay(500);
      } else if (lastMessageTextCheckCount >= 2 || messages.length === 0 || lastMessageText === "") {
        consecutiveStableChecks += 1;
        if (consecutiveStableChecks < requiredStableChecks) await delay(500);
      } else {
        await delay(500);
      }
    }
  };

  const waitForGrokContent = async () => {
    if (!window.location.hostname.includes("x.com") || !window.location.pathname.includes("/i/grok")) return;

    const errorIndicators = ["Something went wrong", "Try again", "privacy related extensions"];
    const pageText = document.body.textContent || "";
    if (errorIndicators.some((indicator) => pageText.includes(indicator))) return;

    const hasChatSignal = () => {
      const mainArea = document.querySelector("main, [role='main'], [data-testid='grok-conversation']");
      if (!mainArea) return false;
      const textLen = mainArea.textContent?.trim().length || 0;
      if (textLen > 100) return true;
      return Boolean(
        mainArea.querySelector(
          "div.message-bubble, [data-testid*='message'], [class*='markdown'], [class*='prose'], [role='article']"
        )
      );
    };

    if (hasChatSignal()) {
      await delay(1000);
      return;
    }

    await delay(2000);
    for (let attempts = 0; attempts < 15; attempts++) {
      if (hasChatSignal()) return;
      await delay(500);
    }
  };

  const autoloadFullHistory = async () => {
    const adapter = getAdapter();
    if (!adapter) return;

    const scrollContainer = adapter.scrollContainer?.();
    if (!scrollContainer) return;

    scrollContainer.scrollTop = 0;
    await delay(500);

    let previousHeight = 0;
    let previousMessageCount = 0;
    let stagnantRounds = 0;
    const countSelector = adapter.countSelector || adapter.messageSelectors.join(", ");

    for (let i = 0; i < 50 && stagnantRounds < 5; i += 1) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
      await delay(500);

      const currentHeight = scrollContainer.scrollHeight;
      const currentMessageCount = document.querySelectorAll(countSelector).length;

      if (currentHeight <= previousHeight && currentMessageCount <= previousMessageCount) {
        stagnantRounds += 1;
      } else {
        stagnantRounds = 0;
      }

      previousHeight = currentHeight;
      previousMessageCount = currentMessageCount;
    }

    if (isStreaming()) {
      await waitForStreamingToComplete();
    }

    await delay(1000);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await delay(500);

    if (isStreaming()) await waitForStreamingToComplete();
  };

  const collectMessages = () => {
    const adapter = getAdapter();
    const siteType = getSiteType();
    if (!adapter) throw new Error("Unsupported site.");

    if (adapter.collectMessagesCustom) {
      const custom = adapter.collectMessagesCustom();
      if (custom != null) {
        const result = deduplicateMessages(custom, adapter);
        if (!result.length) throw new Error(`Unable to locate ${siteType} chat messages.`);
        return result;
      }
    }

    const seen = new Set();
    const nodes = [];

    for (const selector of adapter.messageSelectors) {
      try {
        for (const node of document.querySelectorAll(selector)) {
          if (seen.has(node)) continue;

          let isDescendant = false;
          for (const selectedNode of nodes) {
            if (selectedNode !== node && selectedNode.contains(node)) {
              isDescendant = true;
              break;
            }
          }
          if (isDescendant) continue;

          for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i] !== node && node.contains(nodes[i])) {
              nodes.splice(i, 1);
              break;
            }
          }

          if (node.offsetParent === null && node.style.display === "none") continue;
          if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") continue;

          const text = node.textContent?.trim() || "";
          if (text.length < 5) continue;
          if (adapter.shouldSkipNode?.(node, text)) continue;

          seen.add(node);
          nodes.push(node);
        }
      } catch (e) {
        console.error(`[SparXion Chat Xport] Error with selector "${selector}":`, e);
      }
    }

    if (!nodes.length) {
      throw new Error(`Unable to locate ${siteType} chat messages.`);
    }

    nodes.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    const messages = nodes
      .map((node, index) => {
        const wrapper = adapter.getWrapper?.(node) || node;
        const bubble = adapter.getBubble?.(node) || node;
        const auth = adapter.detectAuthor(node, wrapper);
        const author = adapter.resolveAuthor(auth, index);

        const timestamp =
          wrapper?.querySelector?.("time")?.getAttribute?.("datetime") ||
          wrapper?.querySelector?.("time")?.textContent ||
          null;

        if (!bubble?.nodeType) return null;

        let markdown = "";
        try {
          markdown = toMarkdown(bubble);
        } catch (e) {
          console.error(`[SparXion Chat Xport] Error converting message ${index + 1}:`, e);
          markdown = bubble.textContent?.trim() || "";
        }

        if (adapter.postProcessMarkdown) {
          markdown = adapter.postProcessMarkdown(markdown);
        }

        return { author, timestamp: timestamp?.toString().trim() || null, markdown };
      })
      .filter(Boolean);

    return deduplicateMessages(messages, adapter);
  };

  const deduplicateMessages = (messages, adapter) => {
    const minLength = adapter?.minMarkdownLength ?? 10;
    const seenContent = new Set();
    const deduplicated = [];

    for (const message of messages) {
      const markdown = message.markdown.trim();
      if (markdown.length < minLength) continue;
      if (UI_SKIP_PATTERNS.some((pattern) => pattern.test(markdown))) continue;

      const uiElementCount = (markdown.match(/⌘[A-Z]/gi) || []).length;
      const menuItemCount = (markdown.match(/^-\s*(Search|Chat|Voice|Imagine|Projects|Pinned|History)/gim) || []).length;
      if (uiElementCount > 0 || menuItemCount > 1) continue;

      const signature = `${message.author}|${markdown.toLowerCase().replace(/\s+/g, " ")}`;
      if (!seenContent.has(signature)) {
        seenContent.add(signature);
        deduplicated.push(message);
      }
    }

    return deduplicated;
  };

  const getChatTitle = () => {
    const adapter = getAdapter();
    const siteType = getSiteType();
    const title = adapter?.getTitle?.();
    return title || `${siteType}-chat`;
  };

  const getChatDate = () => {
    const adapter = getAdapter();
    return adapter?.getDate?.() || null;
  };

  const buildMarkdown = (messages, overrides = {}) => {
    const siteType = getSiteType();
    const chatTitle = overrides.title || getChatTitle();
    const chatDate = overrides.chatDate !== undefined ? overrides.chatDate : getChatDate();
    const titleLine =
      chatTitle && chatTitle !== `${siteType}-chat`
        ? `# ${chatTitle}`
        : `# ${siteType.charAt(0).toUpperCase() + siteType.slice(1)} Conversation`;

    const header = [titleLine, "", `- Exported: ${new Date().toISOString()}`];
    if (chatDate) {
      const dateObj = new Date(chatDate);
      header.push(`- Created: ${dateObj.toISOString()} (${dateObj.toLocaleDateString()})`);
    }
    header.push(`- URL: ${window.location.href}`, "");

    const body = messages.flatMap(({ author, timestamp, markdown }) => [
      `## ${author}${timestamp ? ` · ${timestamp}` : ""}`,
      "",
      markdown.trim(),
      "",
    ]);

    return normalizeDownloadText([...header, ...body].join("\n"));
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Plain LF only — strip Unicode line/para separators, CR, NEL, and odd spaces X injects. */
  const normalizeDownloadText = (text) => {
    if (!text) return "";
    return String(text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\u2028/g, "\n") // LINE SEPARATOR
      .replace(/\u2029/g, "\n\n") // PARAGRAPH SEPARATOR
      .replace(/\u0085/g, "\n") // NEXT LINE (NEL)
      .replace(/\u000B/g, "\n") // vertical tab
      .replace(/\u000C/g, "\n") // form feed
      .replace(/\u00A0/g, " ") // NBSP → space
      .replace(/\u2007/g, " ") // figure space
      .replace(/\u202F/g, " ") // narrow NBSP
      .replace(/\u200B/g, "") // zero-width space
      .replace(/\uFEFF/g, "") // BOM
      .replace(/\n{3,}/g, "\n\n");
  };

  const markdownToDataUrl = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return `data:text/markdown;charset=utf-8;base64,${btoa(binary)}`;
  };

  const triggerDownload = async (markdown, fileName) => {
    const runtime = typeof browser !== "undefined" ? browser : chrome;
    markdown = normalizeDownloadText(markdown);

    if (runtime.runtime?.sendMessage) {
      try {
        const response = await runtime.runtime.sendMessage({
          type: "ai-chat-download",
          payload: { markdown, fileName },
        });
        if (response?.success) return;
        if (response?.error) {
          console.warn("[SparXion Chat Xport] Background download failed:", response.error);
        }
      } catch (error) {
        console.warn("[SparXion Chat Xport] Background message failed, using fallback:", error);
      }
    }

    // Page fallback (iframes may lack URL.createObjectURL)
    let url;
    let shouldRevoke = false;
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
      shouldRevoke = true;
    } else {
      url = markdownToDataUrl(markdown);
    }

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    if (shouldRevoke) {
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
  };

  const toMarkdown = (root) => {
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script, style").forEach((el) => el.remove());

    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tagName = node.tagName?.toUpperCase() || "";
      const children = Array.from(node.childNodes);

      if (tagName.match(/^H[1-6]$/)) {
        const level = parseInt(tagName[1], 10);
        return `\n${"#".repeat(level)} ${node.textContent.trim()}\n\n`;
      }
      if (tagName === "P") {
        const text = children.map((c) => processNode(c)).join("").trim();
        return text ? `${text}\n\n` : "\n";
      }
      if (tagName === "BR") return "\n";
      if (tagName === "PRE") {
        const codeNode = node.querySelector("code");
        const language = codeNode?.getAttribute("data-language") || "";
        return `\n\`\`\`${language}\n${node.textContent.trim()}\n\`\`\`\n\n`;
      }
      if (tagName === "BLOCKQUOTE") {
        const text = node.textContent.trim();
        return `\n${text.split("\n").map((l) => `> ${l.trim()}`).join("\n")}\n\n`;
      }
      if (tagName === "UL" || tagName === "OL") {
        const items = Array.from(node.querySelectorAll("li"));
        const list = items
          .map((li, i) => `${tagName === "OL" ? `${i + 1}. ` : "- "}${li.textContent.trim()}`)
          .join("\n");
        return `\n${list}\n\n`;
      }
      if (tagName === "STRONG" || tagName === "B") {
        const text = children.map((c) => processNode(c)).join("").trim();
        return text ? `**${text}**` : "";
      }
      if (tagName === "EM" || tagName === "I") {
        const text = children.map((c) => processNode(c)).join("").trim();
        return text ? `*${text}*` : "";
      }
      if (tagName === "CODE") {
        if (node.parentElement?.tagName === "PRE") return node.textContent.trim();
        const text = children.map((c) => processNode(c)).join("").trim();
        return text ? `\`${text}\`` : "";
      }
      if (tagName === "A") {
        const href = node.getAttribute("href") || "";
        const text = children.map((c) => processNode(c)).join("").trim();
        return text ? `[${text}](${href})` : "";
      }
      if (tagName === "IMG") {
        return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src") || ""})`;
      }
      if (tagName === "SCRIPT" || tagName === "STYLE") return "";
      return children.map((c) => processNode(c)).join("");
    };

    let markdown = processNode(clone);
    const lines = markdown.split("\n");
    const cleanedLines = [];
    const bulletContent = new Set();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.match(/^\d+\.\s/)) {
        const content = trimmed.replace(/^[-•]\s*/, "").replace(/^\d+\.\s*/, "").trim();
        if (content) bulletContent.add(content.toLowerCase().replace(/\s+/g, " "));
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const isPlainText =
        trimmed &&
        !trimmed.startsWith("- ") &&
        !trimmed.match(/^\d+\.\s/) &&
        !trimmed.match(/^#+\s/) &&
        !trimmed.startsWith(">") &&
        !trimmed.startsWith("```");

      if (isPlainText) {
        const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
        let shouldSkip = bulletContent.has(normalized);
        if (!shouldSkip && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith("- ") || nextLine.match(/^\d+\.\s/)) {
            const nextContent = nextLine.replace(/^[-•]\s*/, "").replace(/^\d+\.\s*/, "").trim();
            if (normalized === nextContent.toLowerCase().replace(/\s+/g, " ")) shouldSkip = true;
          }
        }
        if (shouldSkip) continue;
      }
      cleanedLines.push(lines[i]);
    }

    markdown = cleanedLines.join("\n");
    markdown = markdown.replace(/^\s*\*+\s*$/gm, "");
    markdown = markdown.replace(/\n\s*\*+\s*\n/g, "\n");
    markdown = markdown.replace(/\*{3,}/g, (match) => "**".repeat(Math.floor(match.length / 2)));
    markdown = markdown.replace(/\n{3,}/g, "\n\n");
    markdown = markdown.replace(/[ \t]+/g, " ");
    markdown = markdown.replace(/[ \t]+\n/g, "\n");
    markdown = markdown.replace(/\n[ \t]+/g, "\n");

    return markdown.trim();
  };

  toMarkdownRef = toMarkdown;

  const slugify = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 64) || "ai-chat";

  const init = () => {
    if (!isChatPage()) return;
    ensureButton();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  const observer = new MutationObserver(() => {
    if (isChatPage()) ensureButton();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
