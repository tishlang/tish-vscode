# Changelog

## Unreleased

- **tish 2.x support:** pinned the bundled language server to **`tish-lsp` v2.0.3** (`tishLsp.releaseTag`) — the first tish release to ship `tish-lsp-<platform>` binaries. This brings diagnostics and formatting in line with tish/lattish 2.x (JSX text after a child element, the `delete` operator, missing-property → `null`, string relational operators, `\xNN`/`\uNNNN` escapes, etc.). The server bundles both **lint** (`tishlang_lint`) and **format** (`tishlang_fmt`).
- **Single language mode:** `tish-jsx` / separate TextMate bundle removed. One grammar (`source.tish`) includes JSX; **`.tish`** maps to language id **`tish`**. LSP and format-on-save apply uniformly.
- **Format on save** defaults to **off** (`tish.format.enable`): `tish_fmt` is lossy (no comment preservation). JSX formatting in the printer uses line breaks when children are not a single plain-text line.
- **Extension:** trusted Markdown for hovers; log lines after LSP start; reveal output channel on server **error** only.

## 0.1.0

- Tooling model: **`tish`** = compiler only; **`tish-fmt`**, **`tish-lint`**, **`tish-lsp`** are separate installables.
- Initial release: TextMate grammars for `.tish`, snippets, problem matchers (`tish-compile`, `tish-rustc`).
- **tish-lsp** client: diagnostics, outline, completion, format, go-to-definition, workspace symbols.
- Settings: `tish.languageServerPath`, `tish.trace.server`, `tish.format.enable`.
