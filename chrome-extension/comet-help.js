const status = document.getElementById("status");

document.getElementById("copy").addEventListener("click", async () => {
  try {
    const url = chrome.runtime.getURL("perplexity-comet-export.js");
    const text = await fetch(url).then((response) => response.text());
    await navigator.clipboard.writeText(text);
    status.textContent = "Copied! Paste into the Perplexity page console in Comet.";
  } catch (error) {
    status.textContent = `Copy failed: ${error.message}`;
  }
});

document.getElementById("open-perplexity").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://www.perplexity.ai/" });
});
