// Tokenizes example/fixtures/highlighting.tish with the real TextMate engine and asserts that
// the grammar emits the fine-grained scopes themes key on (function names, calls, properties,
// object keys, JSX attributes, regex literals). Run: `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vsctm = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");

const root = path.resolve(__dirname, "..");
const grammarPath = path.join(root, "syntaxes", "tish.tmLanguage.json");
const fixturePath = path.join(root, "example", "fixtures", "highlighting.tish");

async function loadGrammar() {
  const wasmPath = require.resolve("vscode-oniguruma/release/onig.wasm");
  const wasmBin = fs.readFileSync(wasmPath).buffer;
  const onigLib = oniguruma.loadWASM(wasmBin).then(() => ({
    createOnigScanner: (s) => new oniguruma.OnigScanner(s),
    createOnigString: (s) => new oniguruma.OnigString(s),
  }));
  const registry = new vsctm.Registry({
    onigLib,
    loadGrammar: (scope) => {
      if (scope !== "source.tish") return Promise.resolve(null);
      return Promise.resolve(vsctm.parseRawGrammar(fs.readFileSync(grammarPath, "utf8"), grammarPath));
    },
  });
  const grammar = await registry.loadGrammar("source.tish");
  assert.ok(grammar, "grammar must load");
  return grammar;
}

/** Tokenize the whole fixture; returns [{ line, text, scopes }] for every token. */
function tokenizeAll(grammar, src) {
  const out = [];
  let state = vsctm.INITIAL;
  src.split("\n").forEach((line, i) => {
    const r = grammar.tokenizeLine(line, state);
    for (const t of r.tokens) {
      out.push({ line: i + 1, text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes });
    }
    state = r.ruleStack;
  });
  return out;
}

function hasScope(scopes, prefix) {
  return scopes.some((s) => s === prefix || s.startsWith(prefix + "."));
}

/** True when some token with exactly `text` on `line` carries a scope starting with `prefix`. */
function has(tokens, text, line, prefix) {
  const same = tokens.filter((t) => t.text === text && t.line === line);
  assert.ok(same.length > 0, `no token "${text}" on line ${line}`);
  return same.some((t) => hasScope(t.scopes, prefix));
}

test("grammar is valid JSON with the expected scope name", () => {
  const g = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
  assert.equal(g.scopeName, "source.tish");
  assert.ok(Object.keys(g.repository).length > 20, "grammar has a real repository");
});

test("fixture tokenizes into fine-grained scopes", async () => {
  const grammar = await loadGrammar();
  const src = fs.readFileSync(fixturePath, "utf8");
  const tokens = tokenizeAll(grammar, src);

  // Every token must carry the source scope and there must be no runaway begin/end.
  for (const t of tokens) assert.equal(t.scopes[0], "source.tish");

  // import bindings + module string
  assert.ok(has(tokens, "import", 1, "keyword.control.import"));
  assert.ok(has(tokens, "PageHeader", 1, "variable.other.readwrite.alias"));
  assert.ok(has(tokens, "./ui.tish", 1, "string.quoted.double"));

  // let bindings: constant-case + plain
  assert.ok(has(tokens, "PAGE_SIZE", 3, "variable.other.constant"));
  assert.ok(has(tokens, "pages", 8, "variable.other.readwrite"));

  // doc comment
  assert.ok(has(tokens, "/**", 6, "comment.block.documentation"));

  // function declaration: export / fn / name / params
  assert.ok(has(tokens, "export", 7, "keyword.control.export"));
  assert.ok(has(tokens, "fn", 7, "storage.type.function"));
  assert.ok(has(tokens, "pagePaths", 7, "entity.name.function"));
  assert.ok(has(tokens, "ctx", 7, "variable.parameter"));

  // member call + builtin object + property
  assert.ok(has(tokens, "Math", 8, "support.class.builtin"));
  assert.ok(has(tokens, "ceil", 8, "entity.name.function.member"));
  assert.ok(has(tokens, "length", 8, "variable.other.property"));
  assert.ok(has(tokens, "/", 8, "keyword.operator.arithmetic"));

  // object-literal keys and plain call
  assert.ok(has(tokens, "params", 11, "meta.object-literal.key"));
  assert.ok(has(tokens, "n", 11, "meta.object-literal.key"));
  assert.ok(has(tokens, "String", 11, "entity.name.function"));
  assert.ok(has(tokens, "<=", 11, "keyword.operator.comparison"));

  // type alias + annotations
  assert.ok(has(tokens, "Options", 15, "entity.name.type.alias"));
  assert.ok(has(tokens, "string", 15, "support.type.primitive"));
  assert.ok(has(tokens, "async", 17, "storage.modifier.async"));
  assert.ok(has(tokens, "listing", 17, "entity.name.function"));
  assert.ok(has(tokens, "number", 17, "support.type.primitive"));
  assert.ok(has(tokens, "Options", 17, "entity.name.type"));
  assert.ok(has(tokens, "Promise", 17, "entity.name.type"));

  // `in` operator, ternary, null
  assert.ok(has(tokens, "in", 19, "keyword.operator.expression.in"));
  assert.ok(has(tokens, "null", 19, "constant.language.null"));

  // regex literal (must NOT be division)
  assert.ok(has(tokens, "gi", 21, "keyword.other"));
  const reTokens = tokens.filter((t) => t.line === 21 && hasScope(t.scopes, "string.regexp"));
  assert.ok(reTokens.length >= 3, "regex body tokenized as string.regexp");

  // template literal with embedded expression + trailing line comment
  assert.ok(has(tokens, "page ", 22, "string.template"));
  assert.ok(has(tokens, "total", 22, "variable.other.property"));
  assert.ok(has(tokens, " trailing comment", 22, "comment.line.double-slash"));

  // numbers
  assert.ok(has(tokens, "0.5", 23, "constant.numeric.decimal"));
  assert.ok(has(tokens, "0x1F", 23, "constant.numeric.hex"));
  assert.ok(has(tokens, "1e3", 23, "constant.numeric.decimal"));

  // arrow fn, optional chaining, nullish, single-quoted string
  assert.ok(has(tokens, "=>", 24, "storage.type.function.arrow"));
  assert.ok(has(tokens, "??", 24, "keyword.operator.logical"));
  assert.ok(has(tokens, "none", 24, "string.quoted.single"));

  // JSX: intrinsic tag, component, attribute, string value, embedded expression, spread, fragment
  assert.ok(has(tokens, "div", 26, "entity.name.tag"));
  assert.ok(has(tokens, "PageHeader", 27, "support.class.component"));
  assert.ok(has(tokens, "title", 27, "entity.other.attribute-name"));
  assert.ok(has(tokens, "flex flex-wrap gap-2 mb-8", 28, "string.quoted.double"));
  assert.ok(has(tokens, "===", 28, "keyword.operator.comparison"));
  assert.ok(has(tokens, "map", 28, "entity.name.function.member"));
  assert.ok(has(tokens, "...", 29, "keyword.operator.spread"));
  assert.ok(has(tokens, "<", 31, "meta.tag"));
  assert.ok(has(tokens, "</", 32, "punctuation.definition.tag.begin"));

  // The closing brace of the function is plain punctuation — proves no JSX/regex rule ran away.
  assert.ok(has(tokens, "}", 34, "punctuation.definition.block"));
});
