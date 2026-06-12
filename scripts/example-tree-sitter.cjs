#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadManifest } = require("./verify-manifest.cjs");

const repoRoot = path.resolve(__dirname, "..");
const exampleDir = path.join(repoRoot, "example");
const isWin = process.platform === "win32";

function grammarRoot() {
  const env = process.env.TISH_REPO?.trim();
  if (env) {
    const p = path.join(env, "tree-sitter-tish");
    if (fs.existsSync(path.join(p, "tree-sitter.json"))) return p;
  }
  const sibling = path.join(repoRoot, "..", "tish", "tree-sitter-tish");
  if (fs.existsSync(path.join(sibling, "tree-sitter.json"))) return sibling;
  return null;
}

function main() {
  const root = grammarRoot();
  if (!root) {
    console.log("example:tree-sitter skipped (no tree-sitter-tish; set TISH_REPO or place tish next to tish-vscode)");
    process.exit(0);
  }

  const manifest = loadManifest(repoRoot);
  const paths = manifest.treeSitter?.paths || [];
  if (!paths.length) {
    console.log("example:tree-sitter skipped (no treeSitter.paths in verify-manifest.json)");
    process.exit(0);
  }

  const cliPkg = "tree-sitter-cli@0.25.8";
  for (const rel of paths) {
    const abs = path.join(exampleDir, rel);
    if (!fs.existsSync(abs)) {
      console.error(`Missing file for tree-sitter: ${abs}`);
      process.exit(1);
    }
    const npx = spawnSync("npx", ["--yes", cliPkg, "parse", abs], {
      encoding: "utf8",
      cwd: root,
      shell: isWin,
    });
    if (npx.status !== 0) {
      console.error(`tree-sitter parse failed for ${abs}:\n${npx.stderr || npx.stdout}`);
      process.exit(1);
    }
  }
  console.log("example:tree-sitter OK");
}

main();
