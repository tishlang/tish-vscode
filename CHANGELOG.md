# Changelog

## Unreleased

- **Bundled language server (no download).** `tish-lsp` now ships **inside the extension** instead of being downloaded from GitHub Releases on first launch. Each platform-specific `.vsix` carries only its own `tish-lsp` binary (`server/tish-lsp`), staged at build time from the pinned **`@tishlang/tish-lsp`** dependency (**2.1.0**, tish/lattish 2.x). This removes the runtime download, cache, 404 handling, and the `tish.languageServerDownload.*` settings — and works offline. The JS is now bundled with **esbuild** (fixes a `Cannot find module 'vscode-languageclient/node'` activation failure). Override the bundled server with `tish.languageServerPath` or `tish-lsp` on PATH. The server still provides **lint** (`tishlang_lint`) and **format** (`tishlang_fmt`) — JSX after a child element, the `delete` operator, missing-property → `null`, string relational operators, `\xNN`/`\uNNNN` escapes, etc.
- **Single language mode:** `tish-jsx` / separate TextMate bundle removed. One grammar (`source.tish`) includes JSX; **`.tish`** maps to language id **`tish`**. LSP and format-on-save apply uniformly.
- **Format on save** defaults to **off** (`tish.format.enable`): `tish_fmt` is lossy (no comment preservation). JSX formatting in the printer uses line breaks when children are not a single plain-text line.
- **Extension:** trusted Markdown for hovers; log lines after LSP start; reveal output channel on server **error** only.

## 0.1.0

- Tooling model: **`tish`** = compiler only; **`tish-fmt`**, **`tish-lint`**, **`tish-lsp`** are separate installables.
- Initial release: TextMate grammars for `.tish`, snippets, problem matchers (`tish-compile`, `tish-rustc`).
- **tish-lsp** client: diagnostics, outline, completion, format, go-to-definition, workspace symbols.
- Settings: `tish.languageServerPath`, `tish.trace.server`, `tish.format.enable`.
