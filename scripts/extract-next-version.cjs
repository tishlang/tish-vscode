#!/usr/bin/env node
/**
 * Parse semantic-release --dry-run log and print the next release version (stdout).
 * Mirrors the intent of tish's sed on "Published release X.Y.Z" but tolerates ANSI and wording changes.
 */
const fs = require("fs");

const path = process.argv[2] || "semantic-release.log";
const raw = fs.readFileSync(path, "utf8");
const log = raw.replace(/\u001b\[[0-9;]*m/g, "");

// Order matters: most specific first
const patterns = [
  /Published release (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/i,
  /next release version is (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/i,
  /\[semantic-release\][^\n]*Published release (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/i,
];

for (const re of patterns) {
  const m = log.match(re);
  if (m) {
    process.stdout.write(m[1]);
    process.exit(0);
  }
}

process.stderr.write(
  `Could not parse next version from ${path}. Last 80 lines:\n${log.split("\n").slice(-80).join("\n")}\n`
);
process.exit(1);
