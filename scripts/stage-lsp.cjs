#!/usr/bin/env node
'use strict';

/**
 * Copy the @tishlang/tish-lsp platform binary into ./server/ so it gets bundled into the .vsix.
 *
 * The tish-lsp version is pinned via the @tishlang/tish-lsp devDependency in package.json; the npm
 * package ships all platform binaries under platform/<os>-<arch>/. We copy exactly one — the target
 * platform's — so each platform-specific .vsix carries only its own binary.
 *
 * Target defaults to the current machine; CI sets TISH_LSP_TARGET=<vsce target> when building a
 * platform-specific .vsix (e.g. `vsce package --target darwin-arm64`).
 */

const fs = require('fs');
const path = require('path');

// vsce target id === @tishlang/tish-lsp platform dir id (linux-x64, linux-arm64, darwin-arm64,
// darwin-x64, win32-x64). Default to this machine's platform-arch.
const target = (process.env.TISH_LSP_TARGET || `${process.platform}-${process.arch}`).trim();
const isWin = target.startsWith('win32');
const binName = isWin ? 'tish-lsp.exe' : 'tish-lsp';

const root = path.join(__dirname, '..');
const src = path.join(root, 'node_modules', '@tishlang', 'tish-lsp', 'platform', target, binName);
const destDir = path.join(root, 'server');
const dest = path.join(destDir, binName);

if (!fs.existsSync(src)) {
  console.error(`[stage-lsp] No tish-lsp binary for target "${target}" at:\n  ${src}`);
  console.error('[stage-lsp] Is @tishlang/tish-lsp installed (npm ci)? Is TISH_LSP_TARGET a valid platform (e.g. darwin-arm64, linux-x64, win32-x64)?');
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
// Clear any stale binary from a previous target so the .vsix never carries the wrong arch.
for (const f of fs.readdirSync(destDir)) {
  if (f === 'tish-lsp' || f === 'tish-lsp.exe') fs.rmSync(path.join(destDir, f));
}
fs.copyFileSync(src, dest);
if (!isWin) fs.chmodSync(dest, 0o755);
console.log(`[stage-lsp] ${target} -> server/${binName}`);
