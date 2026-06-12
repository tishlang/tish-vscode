"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { validateManifest, loadManifest, allPassed } = require("../scripts/verify-manifest.cjs");

test("validateManifest rejects bad schema", () => {
  assert.throws(() => validateManifest({ schemaVersion: 0, fixtures: [] }), /schemaVersion/);
});

test("validateManifest rejects missing fixture path", () => {
  assert.throws(() => validateManifest({ schemaVersion: 1, fixtures: [{}] }), /path/);
});

test("validateManifest rejects bad fmt expect", () => {
  assert.throws(
    () =>
      validateManifest({
        schemaVersion: 1,
        fixtures: [{ path: "x.tish", fmtCheck: { expect: "maybe" } }],
      }),
    /fmtCheck\.expect/
  );
});

test("loadManifest loads repo example manifest", () => {
  const repo = path.resolve(__dirname, "..");
  const m = loadManifest(repo);
  assert.strictEqual(m.schemaVersion, 1);
  assert.ok(m.fixtures.length >= 1);
  const paths = new Set(m.fixtures.map((f) => f.path));
  assert.ok(paths.has("fixtures/valid.tish"));
});

test("allPassed", () => {
  assert.strictEqual(allPassed([true, true]), true);
  assert.strictEqual(allPassed([true, false]), false);
});
