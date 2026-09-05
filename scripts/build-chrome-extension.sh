#!/usr/bin/env bash
# Build a production ZIP for Chrome Web Store submission.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/chrome-extension"
OUT_DIR="$ROOT/dist"
VERSION="$(grep '"version"' "$SRC/manifest.json" | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')"
ZIP="$OUT_DIR/sparxion-chat-xport-chrome-v${VERSION}.zip"

mkdir -p "$OUT_DIR"
rm -f "$ZIP"

(
  cd "$SRC"
  zip -r "$ZIP" . \
    -x "*.DS_Store" \
    -x "README.md"
)

echo "Built: $ZIP"
echo "Files:"
unzip -l "$ZIP"
