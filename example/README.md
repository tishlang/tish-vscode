# Example harness (maintainer DX)

Automated checks for **Tish CLI** behavior against small tracked fixtures. This is **not** shipped in the VSIX (see `.vscodeignore`).

## Commands (see root `package.json`)

| Script | Purpose |
|--------|---------|
| `npm run example:verify` | Runs `tish-fmt --check`, `tish-lint`, and `tish run` per [`verify-manifest.json`](verify-manifest.json). Writes `toolchain-lock.txt` (gitignored). **Exits non-zero** on failure. |
| `npm run example:reset` | Deletes `example/scratch/` and copies `example/fixtures/` into `example/scratch/fixtures/` for local experiments (scratch is gitignored). |
| `npm run example:tree-sitter` | Runs `npx tree-sitter-cli@0.25.8 parse` on paths in `verify-manifest.json` → `treeSitter.paths`, from a grammar checkout. **Exits 0** with a skip message if `../tish/tree-sitter-tish` (or `TISH_REPO/tree-sitter-tish`) is missing. |

## Pinning

- **Extension LSP** uses `package.json` → `tishLsp.releaseTag` (default `v0.1.1`) for downloaded `tish-lsp`.
- **This harness** expects **`tish`**, **`tish-fmt`**, and **`tish-lint`** on `PATH` from the **same release family**, or set **`TISH_BIN_DIR`** to a directory containing those three binaries (e.g. `…/tish/target/release` after `cargo build --release -p tishlang -p tishlang_fmt -p tishlang_lint`).
- **`toolchain-lock.txt`** is regenerated each verify run; do not commit it.

## Fixture catalog

Every tracked `.tish` under `fixtures/` is listed in `verify-manifest.json` with expected outcomes.

| File | `tish-fmt --check` | `tish-lint` | `tish run` |
|------|-------------------|-------------|------------|
| `fixtures/valid.tish` | pass | exit 0 | exit 0 |
| `fixtures/parse_error.tish` | fail (non-zero) | exit 1, output contains `tish-parse-error` | exit 1 |
| `fixtures/ugly_format.tish` | fail | exit 0 | exit 0 |
| `fixtures/lint_empty_catch.tish` | pass | exit 0, stdout contains `tish-empty-catch` | exit 0 |
| `fixtures/lint_duplicate_key.tish` | pass | exit 0, stdout contains `tish-duplicate-key` | exit 0 |
| `fixtures/import_lib.tish` | pass | exit 0 | exit 0 |
| `fixtures/import_consumer.tish` | pass | exit 0 | exit 0 |
| `fixtures/tree_sitter_subset/minimal.tish` | pass | exit 0 | exit 0 |

Tree-sitter-only paths are under `treeSitter.paths` in the manifest (subset grammar; not a substitute for `tish` parse).

## Optional native build check

Set **`EXAMPLE_VERIFY_BUILD=1`** before `example:verify` to also run `tish build` on `fixtures/valid.tish` (requires a native toolchain). Default verify does **not** run `tish build`.

## Unit tests

`npm test` (repo root) runs Node’s test runner on `test/**/*.test.cjs` — manifest shape validation only; **no** Tish install required.

## Troubleshooting

- **`tish-fmt` not found** — Build or install the formatter (`cargo build -p tishlang_fmt`) or set `TISH_BIN_DIR`.
- **Wrong `tish` on PATH** — Run `which tish` and align with the compiler version you care about.
- **Larger samples** — See the optional sibling checkout [`tish/examples/`](https://github.com/tishlang/tish/tree/main/examples) (not vendored here).

## CI

GitHub Actions job **`example_harness`** clones [`tishlang/tish`](https://github.com/tishlang/tish) at `tishLsp.releaseTag`, builds `tish` + `tish-fmt` + `tish-lint`, then runs `npm ci`, `npm test`, and `npm run example:verify`.
