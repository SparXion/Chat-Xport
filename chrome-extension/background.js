// Copyright (c) 2025-2026 SparXion. All rights reserved.
// SparXion Chat Xport — see /legal/EULA.md

const runtime = typeof browser !== "undefined" ? browser : chrome;

// Service workers (Chrome MV3) do not have URL.createObjectURL — use a data URL instead.
const markdownToDataUrl = (markdown) => {
  const bytes = new TextEncoder().encode(markdown);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:text/markdown;charset=utf-8;base64,${btoa(binary)}`;
};


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

const downloadChat = async (payload) => {
  let { markdown, fileName } = payload;
  markdown = normalizeDownloadText(markdown);
  const url = markdownToDataUrl(markdown);

  const downloadId = await runtime.downloads.download({
    url,
    filename: fileName,
    saveAs: true,
  });

  try {
    await runtime.downloads.show(downloadId);
  } catch (showError) {
    console.warn("[SparXion Chat Xport] Unable to reveal download:", showError);
  }
};

runtime.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ai-chat-download") return;

  downloadChat(message.payload)
    .then(() => sendResponse({ success: true }))
    .catch((error) => {
      console.error("[SparXion Chat Xport] Download error:", error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});

const isPerplexityUrl = (url) => Boolean(url && /^https?:\/\/([^/]+\.)?perplexity\.ai/i.test(url));

runtime.action?.onClicked?.addListener(async (tab) => {
  if (!tab?.id || !isPerplexityUrl(tab.url)) return;

  try {
    const [{ result: hasButton }] = await runtime.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => Boolean(document.getElementById("ai-chat-save-button")),
    });

    if (hasButton) {
      await runtime.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => document.getElementById("ai-chat-save-button")?.click(),
      });
      return;
    }

    await runtime.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["content.js"],
    });
  } catch (error) {
    console.warn("[SparXion Chat Xport] Perplexity injection blocked (likely Comet):", error);
    await runtime.tabs.create({ url: runtime.runtime.getURL("comet-help.html") });
  }
});
