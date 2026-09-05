#!/usr/bin/env bash
# Regenerate extension and Xcode icons from the IconSolo Illustrator export.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_PNG="$ROOT/ChatXport Graphics/ChatXport-001-IconSolo.png"
SRC_AI="$ROOT/ChatXport Graphics/ChatXport-001-IconSolo.ai"
MASTER="$ROOT/ChatXport Graphics/icon-master-1024.png"
CHROME="$ROOT/chrome-extension/icons"
APPICON="$ROOT/Grok Chat Saver/Grok Chat Saver/Shared (App)/Assets.xcassets/AppIcon.appiconset"
LARGE="$ROOT/Grok Chat Saver/Grok Chat Saver/Shared (App)/Assets.xcassets/LargeIcon.imageset"
RES="$ROOT/Grok Chat Saver/Grok Chat Saver/Shared (App)/Resources"

if [[ -f "$SRC_PNG" ]]; then
  echo "Using Illustrator PNG export: $SRC_PNG"
  sips -z 1024 1024 "$SRC_PNG" --out "$MASTER" >/dev/null
elif [[ -f "$SRC_AI" ]]; then
  echo "Exporting raster from Illustrator file (Quick Look)..."
  qlmanage -t -s 2048 -o "$ROOT/ChatXport Graphics" "$SRC_AI" >/dev/null 2>&1
  sips -z 1024 1024 "$ROOT/ChatXport Graphics/ChatXport-001-IconSolo.ai.png" --out "$MASTER" >/dev/null
else
  echo "Missing source: $SRC_PNG or $SRC_AI" >&2
  exit 1
fi

gen() { sips -z "$2" "$2" "$MASTER" --out "$1" >/dev/null; }

mkdir -p "$CHROME" "$APPICON" "$LARGE"

gen "$CHROME/icon-16.png" 16
gen "$CHROME/icon-48.png" 48
gen "$CHROME/icon-128.png" 128

SAFARI_IMG="$ROOT/Grok Chat Saver/Grok Chat Saver/Shared (Extension)/Resources/images"
mkdir -p "$SAFARI_IMG"
gen "$SAFARI_IMG/icon-48.png" 48
gen "$SAFARI_IMG/icon-64.png" 64
gen "$SAFARI_IMG/icon-96.png" 96
gen "$SAFARI_IMG/icon-128.png" 128
gen "$SAFARI_IMG/icon-256.png" 256
gen "$SAFARI_IMG/icon-512.png" 512

for size in 16 32 64 128 256 512 1024; do
  gen "$APPICON/icon-${size}.png" "$size"
done

gen "$LARGE/icon-256.png" 256
gen "$LARGE/icon-512.png" 512
cp "$APPICON/icon-1024.png" "$LARGE/icon-1024.png"
cp "$APPICON/icon-256.png" "$RES/Icon.png"

echo "Icons updated from $MASTER"
echo "Rebuild Chrome package: ./scripts/build-chrome-extension.sh"
