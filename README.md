# SparXion Chat Xport

Export AI conversations to Markdown on your device. Nothing is uploaded — downloads stay local.

Supports **Grok**, **Claude**, **Perplexity**, **ChatGPT**, **Gemini**, **Meta AI**, and **Mistral**.

## Quick start (Chrome)

1. Clone or download this repo
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode**
4. **Load unpacked** → select the `chrome-extension` folder
5. Open a supported chat and use **Download Chat (markdown)**

More detail: [chrome-extension/README.md](chrome-extension/README.md)

## Safari (macOS / iOS)

Open `safari/Grok Chat Saver.xcodeproj` in Xcode, sign with your Apple Developer team, and run.

- [safari/RELOAD_INSTRUCTIONS.md](safari/RELOAD_INSTRUCTIONS.md) — reload after code changes  
- [safari/IOS_SETUP_INSTRUCTIONS.md](safari/IOS_SETUP_INSTRUCTIONS.md) — iOS target notes  

## Repo layout

| Path | What’s in it |
|------|----------------|
| `chrome-extension/` | Chrome / Chromium extension (load unpacked) |
| `safari/` | Safari Web Extension Xcode project |
| `scripts/` | Build zip + local paste-cleanup helpers |
| `legal/` | EULA and privacy policy |
| `brand/` | Product icons |

## Build a Chrome zip

```bash
./scripts/build-chrome-extension.sh
```

Creates `dist/sparxion-chat-xport-chrome-v*.zip` for store submission.

## License

Proprietary — see [LICENSE](LICENSE). © SparXion.
