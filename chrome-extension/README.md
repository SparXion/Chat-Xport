# SparXion Chat Xport - Chrome Extension

Download AI conversations as Markdown files.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. Visit any supported AI chat platform and look for the "Download Chat (markdown)" button

## Supported Platforms

- **Grok** (grok.com, x.com/i/grok)
- **Claude.ai** (claude.ai)
- **Perplexity** (perplexity.ai) — works in **Chrome** and other Chromium browsers
- **ChatGPT** (chatgpt.com, chat.openai.com)
- **Gemini** (gemini.google.com, bard.google.com)
- **Meta AI** (meta.ai)
- **Mistral Vibe** (chat.mistral.ai, lechat.mistral.ai)

## Usage

When viewing a conversation on any supported platform, click the "Download Chat (markdown)" button in the bottom-right corner. The extension will:

- Automatically detect which platform you're using
- Scroll to load the full conversation history
- Wait for streaming responses to finish
- Extract all messages with proper formatting
- Convert them to Markdown format
- Download as a `.md` file with a timestamped filename

On **Perplexity in Chrome**, you can also click the **extension toolbar icon** to trigger export.

### x.com / i/grok exports

1. Open the conversation at `https://x.com/i/grok?conversation=…`
2. Wait for the thread to finish loading, then click **Download Chat (markdown)**
3. Filenames use the `grok-x-…` prefix and include the conversation snowflake date when available

If the live button misses turns (lazy-load / DOM changes), use the paste fallback:

1. On the x.com Grok page: Select All → Copy
2. Save the paste to a `.md` file
3. Clean it locally (no upload):

```bash
node scripts/normalize-x-grok-paste.js /path/to/raw-paste.md ./cleaned.md \
  --url 'https://x.com/i/grok?conversation=YOUR_ID' \
  --title 'Optional title'
```

Or, with the extension loaded on an x.com Grok tab, DevTools console:

```js
copy(__SPARXION_NORMALIZE_X_GROK_PASTE__(rawPasteText, {
  url: location.href,
  title: 'Optional title'
}).markdown)
```

The normalizer strips X chrome (`Home` / `Explore` / `See new posts` / `N posts` / `N web pages` / the download button label), restores mashed sentence spacing, and emits `## User` / `## Grok` archive Markdown.

## Perplexity in Comet browser (important)

**Third-party extensions cannot run on `perplexity.ai` inside Perplexity Comet.** This is intentional Comet browser policy, not a bug in this extension.

Comet adds `perplexity.ai` to an internal **`runtime_blocked_hosts`** list. That blocks:

- Manifest content scripts
- Dynamic injection (`chrome.scripting.executeScript`)
- The Chrome DevTools Protocol / debugger API

You will see the **same behavior with other extensions** — for example, Adobe Acrobat’s “Convert to PDF” button works on Perplexity in Chrome but not in Comet.

### Comet workaround (console export)

1. In Comet, open your Perplexity conversation.
2. Click the **SparXion Chat Xport icon** in the toolbar → opens help page with instructions.
3. Or manually: open DevTools (**F12** / **⌥⌘I**) → **Console**.
4. Copy/paste the script from [`perplexity-comet-export.js`](perplexity-comet-export.js) and press Enter.
5. Click **Download Chat (Comet export)** or run `__SPARXION_CHAT_XPORT_COMET_EXPORT__()` again.

DevTools console runs as **browser-native page JavaScript**, which Comet does not block.

### Easier alternative

Use **Google Chrome** (not Comet) for Perplexity exports. The floating download button works normally on `https://www.perplexity.ai/search/...`.

## Features

- Multi-platform support with site-specific extraction adapters
- Automatically detects chat pages
- Scrolls to load full conversation history
- Preserves message formatting (bold, italic, code blocks, lists, etc.)
- Includes timestamps and author information
- Generates clean, readable Markdown files

## Chrome Web Store package

Build a submission-ready ZIP (excludes README and dev files):

```bash
chmod +x scripts/build-chrome-extension.sh
./scripts/build-chrome-extension.sh
```

Output: `dist/sparxion-chat-xport-chrome-v1.2.2.zip`

## License

Copyright © 2025–2026 SparXion. All rights reserved.

SparXion Chat Xport is **proprietary software**. Use is governed by the [End User License Agreement](../legal/EULA.md). See also the [Privacy Policy](../legal/privacy-policy.md).

Unauthorized copying, modification, or redistribution is prohibited.
