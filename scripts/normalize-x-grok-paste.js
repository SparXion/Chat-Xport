#!/usr/bin/env node
// Copyright (c) 2025-2026 SparXion. All rights reserved.
// Clean a raw x.com/i/grok Select-All paste into archive Markdown.
//
// Usage:
//   node scripts/normalize-x-grok-paste.js <input.md> [output.md] [--url URL] [--title TITLE]
//
// Example:
//   node scripts/normalize-x-grok-paste.js ~/path/to/raw-paste.md ./cleaned.md \
//     --url 'https://x.com/i/grok?conversation=1896452740089340105'

const fs = require("fs");
const path = require("path");

const { normalizeXGrokPaste } = require("../chrome-extension/normalize-x-grok-paste.js");

const args = process.argv.slice(2);
if (!args.length || args.includes("-h") || args.includes("--help")) {
  console.log(`Usage: node scripts/normalize-x-grok-paste.js <input.md> [output.md] [--url URL] [--title TITLE]

Reads a raw x.com/i/grok paste and writes structured ## User / ## Grok Markdown.
If output is omitted, writes <input-basename>.cleaned.md next to the input.`);
  process.exit(args.length ? 0 : 1);
}

const positional = [];
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url") {
    options.url = args[++i];
  } else if (args[i] === "--title") {
    options.title = args[++i];
  } else if (args[i].startsWith("--")) {
    console.error(`Unknown flag: ${args[i]}`);
    process.exit(1);
  } else {
    positional.push(args[i]);
  }
}

const inputPath = path.resolve(positional[0]);
const outputPath = path.resolve(
  positional[1] ||
    path.join(path.dirname(inputPath), path.basename(inputPath, path.extname(inputPath)) + ".cleaned.md")
);

const raw = fs.readFileSync(inputPath, "utf8");
const result = normalizeXGrokPaste(raw, options);
fs.writeFileSync(outputPath, result.markdown, "utf8");

const { stats } = result;
console.log(`Input:   ${inputPath} (${stats.rawBytes} bytes)`);
console.log(`Output:  ${outputPath} (${stats.cleanedBytes} bytes)`);
console.log(
  `Turns:   ${stats.turnCount} (${stats.userTurns} User / ${stats.grokTurns} Grok)`
);
console.log(
  `Shrink:  ${(((stats.rawBytes - stats.cleanedBytes) / stats.rawBytes) * 100).toFixed(1)}% smaller`
);
console.log("\n--- First ~40 lines ---\n");
console.log(result.markdown.split("\n").slice(0, 40).join("\n"));
