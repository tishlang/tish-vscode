"use strict";

const fs = require("fs");
const path = require("path");

function validateManifest(m) {
  if (!m || typeof m !== "object") throw new Error("manifest must be an object");
  if (m.schemaVersion !== 1) throw new Error(`unsupported schemaVersion: ${m.schemaVersion}`);
  if (!Array.isArray(m.fixtures)) throw new Error("fixtures must be an array");
  for (const f of m.fixtures) {
    if (!f || typeof f !== "object") throw new Error("each fixture must be an object");
    if (typeof f.path !== "string" || !f.path.length) throw new Error("fixture.path required");
    if (f.fmtCheck) {
      const e = f.fmtCheck.expect;
      if (e !== "pass" && e !== "fail") throw new Error(`fixture ${f.path}: fmtCheck.expect must be pass|fail`);
    }
    if (f.lint) {
      if (typeof f.lint.expectExit !== "number")
        throw new Error(`fixture ${f.path}: lint.expectExit must be a number`);
      if (f.lint.stdoutContains && !Array.isArray(f.lint.stdoutContains))
        throw new Error(`fixture ${f.path}: lint.stdoutContains must be an array`);
    }
    if (f.run) {
      if (typeof f.run.expectExit !== "number")
        throw new Error(`fixture ${f.path}: run.expectExit must be a number`);
    }
  }
  if (m.treeSitter) {
    if (!Array.isArray(m.treeSitter.paths)) throw new Error("treeSitter.paths must be an array");
  }
}

function loadManifest(repoRoot) {
  const p = path.join(repoRoot, "example", "verify-manifest.json");
  const raw = fs.readFileSync(p, "utf8");
  const m = JSON.parse(raw);
  validateManifest(m);
  return m;
}

/** @param {boolean[]} results */
function allPassed(results) {
  return results.every(Boolean);
}

module.exports = { validateManifest, loadManifest, allPassed };
