# Tish — VS Code / Cursor extension

Syntax highlighting, snippets, **tish-lsp** (downloaded automatically), and build tasks for the [Tish](https://github.com/tishlang/tish) language.

## Features

| Feature | Details |
|---------|---------|
| **Languages** | **Tish** (`tish`): `.tish` is the primary extension; JSX uses the same grammar and LSP as plain Tish. `.tishx` is still associated for older projects but is optional—same language id and tooling. |
| **Snippets** | `fn`, `afn`, `for`, `try`, `import`, … |
| **LSP** | First launch downloads `tish-lsp` from **Tish GitHub Releases** (cached). Optional PATH / custom path. Release **v0.1.1+** ships scope-aware go-to-definition, hover, references, rename, and lexical completion (build from the Tish repo if that tag is not published yet). |
| **Format on save** | **Off by default** (`tish.format.enable`). Enabling it runs **tish-fmt** via the server: it does **not** keep comments and normalizes layout (JSX gets re-indented). Use **Format Document** manually when you want that. |
| **Tasks** | Example tasks: run file, native compile (see below) |
| **Problem matchers** | `tish-compile`, `tish-rustc` for compile output |

## End users

### No highlighting, no squiggles, no hover (extension seems dead)

1. **Confirm the extension is actually installed** — In **Extensions**, search **Tish** (`tish.tish-extension`). Opening only the `tish` compiler repo does **not** load the VS Code extension from disk; you must **install** it (marketplace / Open VSX / “Install from VSIX”) or use **Run Extension** from a checkout of `tish-vscode`. The `tish` repo includes `.vscode/extensions.json` recommending this extension when your editor supports it.
2. **Prove activation** — Command Palette → **“Tish: Show Extension Output”** (or **“Tish: Show Language Server Output”**). In **Output → “Tish Extension”** you should see `Tish extension activated` within a few lines. If those commands are missing, the extension is not loaded. **Developer: Show Running Extensions** should list **Tish**.
3. **Workspace Trust (Restricted Mode)** — If the banner says the workspace is **restricted** / not trusted, extensions that do not opt in are **disabled** (no grammar, no LSP). This extension declares **limited** trust support so highlighting and a **local** `tish-lsp` still work; **trust the workspace** if you rely on workspace-level download settings or full LSP setup.
4. **Language mode** — Bottom-right must show **Tish** (not Plain Text). Save as `*.tish` or use **Change Language Mode**.

### Go to definition / hover (like TypeScript)

These come from **tish-lsp**, not from TextMate grammar. After opening a `.tish` file, check **Output → Tish Language Server** for `tish-lsp ready`.

1. **Use a current binary** — Downloaded releases can lag your compiler. From the Tish repo run `cargo build -p tishlang_lsp --release` and set **`tish.languageServerPath`** to `…/target/release/tish-lsp`, then reload the window.
2. **Cursor on an identifier** — Cmd/Ctrl+click or **Go to Definition** on the **name** of a call/local (`foo` in `foo()`), not on punctuation.
3. **Trace** — Set **`tish.trace.server`** to `verbose` to confirm `textDocument/definition` / `textDocument/hover` requests in the output channel.

**Lint vs format:** Red/yellow squiggles are **diagnostics** (parse + `tish-lint`). **Format document** / format-on-save uses **`tish_fmt`** and is lossy (comments removed). Keep format-on-save off unless you want normalized code.

- **Language server** — No manual install. On first use, the extension downloads the binary for your OS (see [docs/lsp-release-assets.md](docs/lsp-release-assets.md) for asset names).
- **`tish` on PATH** — Only if you use **Run/Compile** tasks.
- Air-gapped / custom builds: set **`tish.languageServerPath`** or **`tish.languageServerDownload.url`**, or turn off download and use `tish-lsp` on PATH.

### `spawn tish-lsp ENOENT` / LSP won’t start

That means the editor tried to run `tish-lsp` but it isn’t available. Common causes:

1. **Download disabled** — In Settings, enable **`Tish › Language Server Download: Enable`** (`tish.languageServerDownload.enable`), then **Reload Window**. The extension will fetch the binary once and cache it.
2. **GUI apps don’t see your shell PATH** — Even if `tish-lsp` works in Terminal, Cursor/VS Code may not. Set **`tish.languageServerPath`** to the full path of the binary, or rely on automatic download.
3. **Unsupported OS/arch for bundled download** — Set **`tish.languageServerPath`** or **`tish.languageServerDownload.url`** to a matching binary.

### HTTP 404 when downloading `tish-lsp-*`

The extension pulls binaries from **GitHub Releases** (`tish.languageServerDownload.repo` + tag). A **404** means that release URL has no file with that name—often the compiler repo is private, the tag doesn’t exist yet, or CI hasn’t uploaded the assets (see [docs/lsp-release-assets.md](docs/lsp-release-assets.md)).

**Workaround:** From your Tish compiler checkout, build the LSP binary (package name may be `tish_lsp` or `tish-lsp` in that repo), e.g. `cargo build -p tish_lsp --release` or `cargo build --bin tish-lsp --release`, then in Cursor/VS Code set:

**`tish.languageServerPath`** → absolute path to the binary (e.g. `…/tish/target/release/tish-lsp`).

Optionally turn off **`tish.languageServerDownload.enable`** so it doesn’t retry the broken URL each time.

## Extension maintainers (this repo)

- Bump **`tishLsp.releaseTag`** in `package.json` when you want users to pull a newer `tish-lsp` from the Tish repo’s releases.
- The **Tish** repo must publish matching binaries on that tag (see [docs/lsp-release-assets.md](docs/lsp-release-assets.md)).

## Configuration

| Setting | Description |
|---------|-------------|
| `tish.languageServerPath` | Path to `tish-lsp` (overrides everything) |
| `tish.languageServerDownload.enable` | Use GitHub download (default on) |
| `tish.languageServerDownload.repo` / `releaseTag` / `url` | Override download source |
| `tish.trace.server` | LSP trace |
| `tish.format.enable` | Format on save |

## Documentation

**[Tish docs — Editor & IDE](https://tishlang.github.io/tish-docs/getting-started/editor/)**

## Tasks (workspace)

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "tish: run current file",
      "type": "shell",
      "command": "tish",
      "args": ["run", "${file}"],
      "group": "test",
      "problemMatcher": []
    },
    {
      "label": "tish: build (native)",
      "type": "shell",
      "command": "tish",
      "args": ["build", "${file}", "--output", "${workspaceFolder}/tish_out", "--target", "native"],
      "group": "build",
      "problemMatcher": ["$tish-rustc"]
    }
  ]
}
```

## Development

```bash
npm install
npm run compile
```

Press **F5** for Extension Development Host. For LSP during dev, either allow download or set `tish.languageServerPath` in settings.

If you previously set **`files.associations`** to language **`tish-jsx`**, change it to **`tish`** (the `tish-jsx` language id has been removed).

### Debugging F5: prove the LSP is loading

You always have **two windows**: (1) the **tish-vscode** window where you pressed F5 (the debugger), and (2) the **[Extension Development Host]** window that opens (this is the “fake” Cursor/VS Code running your local extension).

Do the checks below **in the Extension Development Host window**, not in the debugger window.

1. **Launch config** — Prefer **Run Extension (rebuild local tish-lsp)** so `../tish/target/debug/tish-lsp` is built and picked up automatically (requires a sibling checkout of the compiler repo next to `tish-vscode`). Otherwise use **Run Extension** and set **`tish.languageServerPath`** in the Host’s settings to your binary.
2. **Open a real folder in the Host** — **File → Open Folder…** and choose the **`tish`** compiler repo (or any project that contains `*.tish`). Until a folder is open, you may not see much LSP traffic.
3. **Output channels** — The extension uses **two** logs (both under **View → Output**):
   - **“Tish Extension”** — always has a short boot banner; enable **`tish.debug.extension`** (or **Tish: Toggle Extension Debug Logging**) for `[tish-ext …]` resolver / client-start detail.
   - **“Tish Language Server”** — download / `Using language server: …`, **`tish-lsp started`**, LSP failures, and **`tish.trace.server`** JSON-RPC.  
   If **“Tish Extension”** never shows `Tish extension activated`, the extension did not activate (wrong window, or extension failed to load). If `tish-lsp started` never appears on the language-server channel, scroll for errors or see the warning toast.
4. **Command Palette** — In the Host: **Tish: Show Extension Output** or **Tish: Show Language Server Output** (forces activation and focuses the matching log).
5. **LSP wire trace** — In the Host open **Settings (JSON)** and set `"tish.trace.server": "verbose"`, then **Reload Window** in the Host. The **same** “Tish Language Server” output will log JSON-RPC (`initialize`, `textDocument/didOpen`, `textDocument/publishDiagnostics`, etc.). Set back to `"off"` when finished.
6. **Breakpoints (extension TypeScript)** — In the **debugger (tish-vscode) window**, open `src/extension.ts` / `src/downloadLsp.ts` and set breakpoints on the lines after `resolveLanguageServerExecutable` and around `client.start()`. They hit when the **Host** activates the extension (e.g. when you open a `.tish` file or run the command from step 4).
7. **Running extensions** — In the Host: **Developer: Show Running Extensions** and confirm **Tish** is listed and not disabled.
8. **Sanity test** — In the Host, open a `.tish` file, confirm the status bar language is **Tish**, introduce a parse error or unknown identifier and confirm squiggles / hover.

**Debugging the Rust `tish-lsp` binary itself** is separate: build with debug symbols from `../tish`, then attach a native debugger to the spawned `tish-lsp` process, or run `tish-lsp` under `lldb`/`gdb` from a terminal and point **`tish.languageServerPath`** at that binary while testing from the Host.

## CI / publishing

Same pattern as [tish](https://github.com/tishlang/tish): CI workflow plus separate release workflows per registry.

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **`vscode-ci.yml`** | push/PR to main, workflow_dispatch | Build VSIX, release_check (conventional commits), create prerelease with tish.vsix. Mirrors build-npm-binaries.yml. |
| **`vscode-release.yml`** | release published/edited | When prerelease promoted to full: download VSIX from release, publish to **Visual Studio Marketplace**. Mirrors npm-release.yml. |
| **`open-vsx-release.yml`** | release published/edited | Same trigger: download VSIX, publish to **[Open VSX](https://open-vsx.org/)** (VSCodium, etc.). |

1. **`VSCE_PAT`** — Visual Studio Marketplace (`vscode-release`).
2. **`VSX_TOKEN`** — Open VSX ([create token](https://open-vsx.org/user-settings/tokens); sign publisher agreement first).
3. **Conventional commits** — feat/fix/perf/BREAKING CHANGE required for main merge.
4. Align **`tishLsp.releaseTag`** with Tish’s GitHub release that ships `tish-lsp` binaries.
