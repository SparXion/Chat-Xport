// Copyright (c) 2025-2026 SparXion. All rights reserved.
// SparXion Chat Xport — Perplexity export for Comet (paste into DevTools Console)
// Comet blocks extension content scripts on perplexity.ai; this runs as page JS.
(function () {
  if (window.__SPARXION_CHAT_XPORT_COMET_EXPORT__) {
    window.__SPARXION_CHAT_XPORT_COMET_EXPORT__();
    return;
  }

  const BUTTON_ID = "ai-chat-saver-comet-export";

  const isUiText = (text) =>
    /^(perplexity|answer|links|images|share|help improve|compare|reviewed \d+ sources?|ask a follow-up|download comet|model)$/i.test(
      text.trim()
    );

  const getRoot = () =>
    document.querySelector(".max-w-threadContentWidth, [class*='threadContentWidth']") ||
    document.querySelector("main") ||
    document.querySelector("#root") ||
    document.body;

  const findUserRoot = (el) => {
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

  const extractUserText = (root) => {
    const lexical = root.querySelectorAll("span[data-lexical-text='true']");
    if (lexical.length) {
      return Array.from(lexical)
        .map((span) => span.textContent?.trim() || "")
        .filter(Boolean)
        .join(" ")
        .trim();
    }
    return (
      root.querySelector("span.select-text")?.textContent?.trim() ||
      root.querySelector(".whitespace-pre-line.text-pretty.break-words")?.textContent?.trim() ||
      root.textContent?.trim() ||
      ""
    );
  };

  const toMarkdown = (root) => {
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script, style").forEach((el) => el.remove());
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const tag = node.tagName?.toUpperCase() || "";
      const kids = Array.from(node.childNodes).map(walk).join("");
      if (tag.match(/^H[1-6]$/)) return `\n${"#".repeat(parseInt(tag[1], 10))} ${node.textContent.trim()}\n\n`;
      if (tag === "P") return kids.trim() ? `${kids.trim()}\n\n` : "";
      if (tag === "PRE") return `\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
      if (tag === "LI") return `- ${node.textContent.trim()}\n`;
      if (tag === "UL" || tag === "OL") return `\n${kids}\n`;
      if (tag === "A") return `[${kids.trim()}](${node.getAttribute("href") || ""})`;
      if (tag === "STRONG" || tag === "B") return kids.trim() ? `**${kids.trim()}**` : "";
      if (tag === "EM" || tag === "I") return kids.trim() ? `*${kids.trim()}*` : "";
      if (tag === "CODE" && node.parentElement?.tagName !== "PRE") return kids.trim() ? `\`${kids.trim()}\`` : "";
      return kids;
    };
    return walk(clone).replace(/\n{3,}/g, "\n\n").trim();
  };

  const collectMessages = () => {
    const container = getRoot();
    const assistantSelector =
      "div[id^='markdown-content-'], [data-testid='answer'], [data-testid='assistant'], [class*='prose'][class*='prose-invert'], .prose.text-pretty";
    const userSelector =
      "h1[class*='group/query'] span.select-text, span.select-text, .whitespace-pre-line.text-pretty.break-words, span[data-lexical-text='true'], div[class*='group/query'] h1, .my-md h1";
    const combined = `${assistantSelector}, ${userSelector}`;
    const results = [];
    const seen = new Set();

    const add = (author, markdown, node) => {
      const text = markdown.trim();
      if (text.length < 2 || (isUiText(text) && text.length < 40)) return;
      const sig = `${author}|${text.toLowerCase().slice(0, 240)}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      results.push({
        author,
        markdown: text,
        top: node?.getBoundingClientRect?.().top ?? 0,
      });
    };

    for (const node of container.querySelectorAll(combined)) {
      if (node.closest("nav, header, aside, [role='navigation'], [role='banner'], button")) continue;

      if (node.matches("div[id^='markdown-content-'], [data-testid='answer'], [data-testid='assistant']")) {
        const bubble = node.querySelector("[class*='prose']") || node;
        add("Perplexity", toMarkdown(bubble), node);
        continue;
      }

      if (node.matches("[class*='prose']")) {
        const nested = [...node.querySelectorAll("[class*='prose']")].filter((el) => el !== node);
        if (nested.length) continue;
        const cls = (node.className || "").toString();
        if (!cls.includes("prose-invert") && !cls.includes("text-pretty") && !node.closest("div[id^='markdown-content-'], .mb-md")) {
          continue;
        }
        add("Perplexity", toMarkdown(node), node);
        continue;
      }

      const root = findUserRoot(node);
      if (root.closest?.("[class*='prose-invert']")) continue;
      add("User", extractUserText(root), root);
    }

    if (!results.some((m) => m.author === "User")) {
      for (const btn of container.querySelectorAll("button[data-testid='copy-query-button'], button[aria-label='Copy Query' i]")) {
        add("User", extractUserText(findUserRoot(btn)), btn);
      }
    }

    if (!results.length) throw new Error("No Perplexity messages found on this page.");
    return results.sort((a, b) => a.top - b.top);
  };

  const slugify = (value) =>
    (value || "perplexity-chat")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);

  const runExport = () => {
    const messages = collectMessages();
    const title = document.title.replace(/\s*(\||-)\s*Perplexity.*$/i, "").trim() || "Perplexity Conversation";
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const body = messages.flatMap(({ author, markdown }) => [`## ${author}`, "", markdown, ""]);
    let file = [
      `# ${title}`,
      "",
      `- Exported: ${now.toISOString()}`,
      `- URL: ${location.href}`,
      "",
      ...body,
    ].join("\n");

    file = file
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\u2028/g, "\n")
      .replace(/\u2029/g, "\n\n")
      .replace(/\u0085/g, "\n")
      .replace(/\u000B/g, "\n")
      .replace(/\u000C/g, "\n")
      .replace(/\u00A0/g, " ")
      .replace(/\u2007/g, " ")
      .replace(/\u202F/g, " ")
      .replace(/\u200B/g, "")
      .replace(/\uFEFF/g, "")
      .replace(/\n{3,}/g, "\n\n");

    const blob = new Blob([file], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(title)}-${stamp}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    console.log(`[SparXion Chat Xport] Exported ${messages.length} messages`);
  };

  const ensureButton = () => {
    if (document.getElementById(BUTTON_ID)) return;
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.textContent = "Download Chat (Comet export)";
    Object.assign(button.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "2147483647",
      padding: "10px 14px",
      borderRadius: "10px",
      border: "0",
      background: "#111",
      color: "#fff",
      fontSize: "14px",
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    });
    button.addEventListener("click", () => {
      try {
        runExport();
      } catch (error) {
        alert(`SparXion Chat Xport (Comet)\n\n${error.message}`);
      }
    });
    document.body.appendChild(button);
  };

  window.__SPARXION_CHAT_XPORT_COMET_EXPORT__ = () => {
    ensureButton();
    console.log("[SparXion Chat Xport] Comet export ready — click the button or run __SPARXION_CHAT_XPORT_COMET_EXPORT__()");
  };

  window.__SPARXION_CHAT_XPORT_COMET_EXPORT__();
})();
