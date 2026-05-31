#!/usr/bin/env node

const fileIndex = process.argv.indexOf("-f");
const filePath = fileIndex >= 0 ? process.argv[fileIndex + 1] : "";

if (!filePath) {
  console.error("missing -f audio path");
  process.exit(2);
}

console.log("[00:00:00.000 --> 00:00:01.000] 안녕 OBA voice sample");
