#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const fixturesDir = path.join(repoRoot, "example", "fixtures");
const scratchDir = path.join(repoRoot, "example", "scratch");

function rmrf(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

rmrf(scratchDir);
fs.mkdirSync(scratchDir, { recursive: true });
copyRecursive(fixturesDir, path.join(scratchDir, "fixtures"));
console.log(`example:reset — copied ${fixturesDir} → ${scratchDir}/fixtures`);
