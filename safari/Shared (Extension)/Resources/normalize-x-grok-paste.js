// Copyright (c) 2025-2026 SparXion. All rights reserved.
// SparXion Chat Xport — offline normalizer for raw x.com/i/grok Select-All pastes.
// Works in Node (CLI) and as a browser global for content scripts / console use.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SparXionNormalizeXGrokPaste = api;
    root.__SPARXION_NORMALIZE_X_GROK_PASTE__ = api.normalizeXGrokPaste;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  const NAV_LABELS = new Set(
    [
      "home",
      "explore",
      "notifications",
      "messages",
      "chat",
      "supergrok",
      "premium+",
      "premium",
      "bookmarks",
      "lists",
      "creator studio",
      "articles",
      "profile",
      "more",
      "post",
      " grok",
      "grok",
      "see new posts",
      "download chat (markdown)",
      "to view keyboard shortcuts, press question mark",
      "view keyboard shortcuts",
    ].map((s) => s.toLowerCase())
  );

  const NOISE_LINE =
    /^(see new posts|download chat\s*\(markdown\)|to view keyboard shortcuts.*|view keyboard shortcuts|\d+\s+(posts?|web pages?)|^\d+[KMB]?$)$/i;

  const GROK_OPENERS =
    /^(reinventing yourself|that(?:'s|’s) an? |i hear you|absolutely|yes[,!]?\s|i get it|got it[.!]?\s|you(?:'re|’re) |here(?:'s|’s) |as of right now|you can(?:'t|’t)? |the good news|if you(?:'re|’re) |sounds like|it sounds like|great question|good question|of course|sure[,!]?\s|fair point|exactly[.!]?\s|alright[,!]?\s|okay[,!]?\s)/i;

  const GROK_SECTION =
    /^(professional experience|early career|education|skills|summary|core competencies|writer &|product design|project designer|freelance|general tips|my suggestion|next steps|for ios|for macos|scripting with|third-party|limitation:|bulk:|clarify |note:)/i;

  const QUESTIONISH = /\?[\s"']*$|[?？]\s*$|^(can i|do i|how |what |where |when |why |who |is |are |should |would |could |will |am i)/i;

  const USER_VOICE =
    /^(i want|i am|i(?:'m|’m)|i(?:'ve|’ve)|i have|i need|i think|i believe|my |the current|can i|do i|here(?:'s|’s) my|please |store it|good\.|replace )/i;

  const isNavOrNoiseLine = (line) => {
    const t = line.trim();
    if (!t) return true;
    if (NOISE_LINE.test(t)) return true;
    if (NAV_LABELS.has(t.toLowerCase())) return true;
    if (/^@\w+$/.test(t) && t.length < 40) return true;
    if (/keyboard shortcuts/i.test(t)) return true;
    // Short display-name chrome: "Johnny Carthief"
    if (t.length <= 40 && !/[.?!,:;]/.test(t) && /^[A-Z][\w'’.-]*(?: [A-Z][\w'’.-]*){0,3}$/.test(t)) {
      return true;
    }
    return false;
  };

  const isNoiseBlock = (text) => {
    const t = text.trim();
    if (!t) return true;
    if (NOISE_LINE.test(t)) return true;
    if (NAV_LABELS.has(t.toLowerCase())) return true;
    const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every(isNavOrNoiseLine)) return true;
    if (lines.length <= 2 && lines.every((l) => l.length < 40) && lines.some((l) => /^@\w+/.test(l))) {
      return true;
    }
    if (/^@\w+$/.test(t) && t.length < 40) return true;
    return false;
  };

  const isLikelyChromeBlock = (text) => isNoiseBlock(text);

  /** Restore spaces lost when X mash-pastes sentences: "you.Next" → "you. Next" */
  const unmashSentences = (text) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts
      .map((part) => {
        if (part.startsWith("```")) return part;
        return part
          .replace(/([.!?:])([A-ZÀ-ÖØ-Þ])/g, "$1 $2")
          .replace(/([.!?])([“"‘'])/g, "$1 $2")
          // Soft line breaks only (single \n) so turn-split on blank lines stays intact
          .replace(/\s+(First,|Next,|Then,|Finally,|Here’s how|Here's how|Start by |Build |Stay )/g, "\n$1");
      })
      .join("");
  };

  /**
   * Live x.com innerText often has NO blank lines between turns.
   * Inject \n\n before clear User↔Grok boundaries so split/classify can work.
   */
  const injectTurnBreaks = (text) => {
    let t = text.replace(/\r\n/g, "\n");

    // Mid-stream citation noise glued into prose
    t = t.replace(/\d+\s+posts?/gi, "\n\n");
    t = t.replace(/\d+\s+web pages?/gi, "\n\n");

    // Grok openers appearing mid-blob (with or without a preceding space)
    const grokBoundary =
      /(Reinventing yourself|That(?:'s|’s) an awesome|That(?:'s|’s) a |I hear you|Absolutely[,!]?\s|Yes, you can absolutely|I get it—|I get it -|Alright, John|Alright[,!]?\s+I|Got it[.!]?\s|Here’s the deal|Here's the deal|You can(?:'t|’t) pay once|I’d love to help|I'd love to help|I’d love to dig|I'd love to dig)/g;
    t = t.replace(grokBoundary, "\n\n$1");

    // User turns after a sentence — only strong first-person / prompt cues
    // (Do NOT split on What's/How — Grok often ends turns with those)
    const userBoundary =
      /([.!?…"'”’])\s*(?=(If I am |I want to |Can I |Do I have |Do I have to |The current,|I really just |I think I(?:'d|’d)? like|johnmark|No, John|los angeles, ca cel:))/gi;
    t = t.replace(userBoundary, "$1\n\n");

    // Run-on with no space: projectsThat's / toys...I hear
    t = t.replace(
      /([a-z])(?=(That(?:'s|’s) an|I hear you|Absolutely|Yes, you can|I get it|Alright,|Reinventing yourself|I’d love|I'd love))/g,
      "$1\n\n"
    );

    return t.replace(/\n{3,}/g, "\n\n");
  };

  const stripLeadingChrome = (blocks) => {
    let i = 0;
    while (i < blocks.length && isLikelyChromeBlock(blocks[i])) i += 1;
    // Drop a lone "See new posts" that survived
    while (i < blocks.length && /^see new posts$/i.test(blocks[i].trim())) i += 1;
    return blocks.slice(i);
  };

  const stripTrailingNoise = (blocks) => {
    let end = blocks.length;
    while (end > 0 && isNoiseBlock(blocks[end - 1])) end -= 1;
    return blocks.slice(0, end);
  };

  const scoreAsGrok = (text, prevAuthor) => {
    let score = 0;
    const t = text.trim();
    const len = t.length;
    if (GROK_OPENERS.test(t)) score += 4;
    if (GROK_SECTION.test(t)) score += 3;
    if (len > 600) score += 3;
    else if (len > 280) score += 2;
    else if (len > 140) score += 1;
    if (/(here(?:'s|’s) how|i can help|if you want, i can|want me to )/i.test(t)) score += 1;
    if (prevAuthor === "User") score += 1;
    // Stay on Grok across multi-paragraph replies unless the block looks like a new user prompt
    if (prevAuthor === "Grok") {
      if (!QUESTIONISH.test(t) && !USER_VOICE.test(t) && len > 80) score += 3;
      if (GROK_SECTION.test(t)) score += 2;
    }
    // First-person user voice should not win as Grok
    if (USER_VOICE.test(t) && len < 800) score -= 3;
    return score;
  };

  const scoreAsUser = (text, prevAuthor) => {
    let score = 0;
    const t = text.trim();
    const len = t.length;
    if (QUESTIONISH.test(t)) score += 3;
    if (USER_VOICE.test(t)) score += 4;
    if (len < 220) score += 2;
    else if (len < 500) score += 1;
    // Raw pasted resume / CV (not Grok's polished rewrite sections)
    if (/johnmark\s*violette|creativeproductdesigner/i.test(t)) score += 5;
    if (/FREELANCE\.\s*•/.test(t) || /\bHASBRO, INC\./.test(t)) score += 3;
    if (prevAuthor === "Grok" && (QUESTIONISH.test(t) || USER_VOICE.test(t))) score += 2;
    if (prevAuthor === "Grok") score += 1;
    if (prevAuthor === "User") score -= 2;
    // Short imperative / store commands are usually the user
    if (len < 80 && /^(store it|good\.|replace |call it|next:|ok\.?$)/i.test(t)) score += 3;
    // Short closing questions after Grok are usually Grok's follow-up, not a new user turn
    if (
      prevAuthor === "Grok" &&
      len < 140 &&
      /\?\s*$/.test(t) &&
      /^(what|which|where|how|who|why|does that|do you|any )/i.test(t)
    ) {
      score -= 4;
    }
    return score;
  };

  const classifyBlock = (text, prevAuthor, preferAlternate) => {
    const u = scoreAsUser(text, prevAuthor);
    const g = scoreAsGrok(text, prevAuthor);

    // Strong signal wins — keeps multi-paragraph Grok replies together
    if (g >= u + 2) return "Grok";
    if (u >= g + 2) return "User";

    if (preferAlternate && prevAuthor) {
      return prevAuthor === "User" ? "Grok" : "User";
    }
    if (g > u) return "Grok";
    if (u > g) return "User";
    if (prevAuthor === "User") return "Grok";
    if (prevAuthor === "Grok") return "User";
    return "User";
  };

  /** Plain LF only — strip Unicode line/para separators, CR, NEL, and odd spaces X injects. */
  const normalizeDownloadText = (text) => {
    if (!text) return "";
    return String(text)
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
  };

  const buildArchiveMarkdown = (messages, options = {}) => {
    const firstLine = ((messages[0] && messages[0].markdown) || "").split(/[.!?\n]/)[0].trim().slice(0, 80);
    const title = options.title || firstLine || "X Grok Conversation";
    const exported = options.exported || new Date().toISOString();
    const url = options.url || null;
    const created = options.created || null;

    const header = [`# ${title}`, "", `- Exported: ${exported}`];
    if (created) header.push(`- Created: ${created}`);
    if (url) header.push(`- URL: ${url}`);
    header.push("");

    const body = messages.flatMap(({ author, markdown }) => [
      `## ${author}`,
      "",
      normalizeDownloadText(markdown.trim()),
      "",
    ]);

    return normalizeDownloadText([...header, ...body].join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n");
  };

  /**
   * @param {string} text Raw Select-All paste from x.com/i/grok
   * @param {{ url?: string, title?: string, created?: string, exported?: string }} [options]
   * @returns {{ markdown: string, messages: Array<{author:string, markdown:string}>, stats: object }}
   */
  const normalizeXGrokPaste = (text, options = {}) => {
    if (!text || typeof text !== "string") {
      throw new Error("normalizeXGrokPaste: expected a non-empty string");
    }

    const rawSize = text.length;
    const prepared = injectTurnBreaks(unmashSentences(text.replace(/\r\n/g, "\n")));

    let blocks = prepared
      .split(/\n{2,}/)
      .map((b) => b.replace(/[ \t]+\n/g, "\n").trim())
      .filter(Boolean);

    blocks = stripLeadingChrome(blocks);
    blocks = stripTrailingNoise(blocks);
    blocks = blocks.filter((b) => !isNoiseBlock(b));

    const messages = [];
    let prevAuthor = null;

    for (const block of blocks) {
      let markdown = unmashSentences(block);
      markdown = markdown.replace(/^(Auto)?See new posts\s*/i, "").trim();
      if (!markdown || isNoiseBlock(markdown)) continue;

      const author = classifyBlock(markdown, prevAuthor, true);
      // Prefer under-splitting: merge consecutive same-author blocks into one turn
      if (messages.length && messages[messages.length - 1].author === author) {
        const prev = messages[messages.length - 1];
        prev.markdown = `${prev.markdown}\n\n${markdown}`;
        continue;
      }

      messages.push({ author, markdown });
      prevAuthor = author;
    }

    // If we somehow labeled everything User, force strict alternation from the start
    const grokCount = messages.filter((m) => m.author === "Grok").length;
    if (messages.length >= 2 && grokCount === 0) {
      for (let i = 0; i < messages.length; i++) {
        messages[i].author = i % 2 === 0 ? "User" : "Grok";
      }
    }

    // Single mega-blob: try harder split + alternate
    if (messages.length === 1 && messages[0].markdown.length > 2000) {
      const mega = injectTurnBreaks(messages[0].markdown);
      const megaBlocks = mega
        .split(/\n{2,}/)
        .map((b) => b.trim())
        .filter((b) => b && !isNoiseBlock(b));
      if (megaBlocks.length >= 2) {
        messages.length = 0;
        prevAuthor = null;
        for (const block of megaBlocks) {
          const markdown = unmashSentences(block);
          const author = classifyBlock(markdown, prevAuthor, true);
          if (messages.length && messages[messages.length - 1].author === author) {
            messages[messages.length - 1].markdown += `\n\n${markdown}`;
          } else {
            messages.push({ author, markdown });
            prevAuthor = author;
          }
        }
      }
    }

    const markdown = buildArchiveMarkdown(messages, options);
    return {
      markdown,
      messages,
      stats: {
        rawBytes: rawSize,
        cleanedBytes: markdown.length,
        turnCount: messages.length,
        userTurns: messages.filter((m) => m.author === "User").length,
        grokTurns: messages.filter((m) => m.author === "Grok").length,
      },
    };
  };

  return {
    normalizeXGrokPaste,
    buildArchiveMarkdown,
    unmashSentences,
    injectTurnBreaks,
    isNoiseBlock,
  };
});
