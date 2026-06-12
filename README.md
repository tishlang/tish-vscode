# Tish — VS Code / Cursor extension

Syntax highlighting, snippets, a **bundled tish-lsp** language server, and build tasks for the [Tish](https://github.com/tishlang/tish) language.

## Features

| Feature | Details |
|---------|---------|
| **Languages** | **Tish** (`tish`): `.tish` only; JSX uses the same grammar and LSP as plain Tish. |
| **Snippets** | `fn`, `afn`, `for`, `try`, `import`, … |
| **LSP** | The `tish-lsp` binary is **bundled in the extension** (platform-specific `.vsix`) — no download, no Rust toolchain. Pinned via the `@tishlang/tish-lsp` dependency (currently **2.1.0**, tish/lattish 2.x): scope-aware go-to-definition, hover, references, rename, lexical completion, diagnostics (`tishlang_lint`), and formatting (`tishlang_fmt`). Override with `tish.languageServerPath` or `tish-lsp` on PATH. |
| **Format on save** | **Off by default** (`tish.format.enable`). Enabling it runs **tish-fmt** via the server: it does **not** keep comments and normalizes layout (JSX gets re-indented). Use **Format Document** manually when you want that. |
| **Tasks** | Example tasks: run file, native compile (see below) |
| **Problem matchers** | `tish-compile`, `tish-rustc` for compile output |

## End users

### No highlighting, no squiggles, no hover (extension seems dead)

1. **Confirm the extension is actually installed** — In **Extensions**, search **Tish** (`tish.tish-extension`). Opening only the `tish` compiler repo does **not** load the VS Code extension from disk; you must **install** it (marketplace / Open VSX / “Install from VSIX”) or use **Run Extension** from a checkout of `tish-vscode`. The `tish` repo includes `.vscode/extensions.json` recommending this extension when your editor supports it.
2. **Prove activation** — Command Palette → **“Tish: Show Extension Output”** (or **“Tish: Show Language Server Output”**). In **Output → “Tish Extension”** you should see `Tish extension activated` within a few lines. If those commands are missing, the extension is not loaded. **Developer: Show Running Extensions** should list **Tish**.
3. **Workspace Trust (Restricted Mode)** — This extension declares **limited** trust support: syntax and the **bundled `tish-lsp`** still work. A workspace-level `tish.languageServerPath` (which could point at an arbitrary executable) is ignored unless you **trust the workspace**.
4. **Language mode** — Bottom-right must show **Tish** (not Plain Text). Save as `*.tish` or use **Change Language Mode**.

### Go to definition / hover (like TypeScript)

These come from **tish-lsp**, not from TextMate grammar. After opening a `.tish` file, check **Output → Tish Language Server** for `tish-lsp ready`.

1. **Bundled binary** — `tish-lsp` ships inside the extension; no install needed. To override (a custom build, or an unsupported arch) set **`tish.languageServerPath`** to a `tish-lsp` binary, or put one on PATH (`npm i -g @tishlang/tish-lsp`), then reload.
2. **Cursor on an identifier** — Cmd/Ctrl+click or **Go to Definition** on the **name** of a call/local (`foo` in `foo()`), not on punctuation.
3. **Trace** — Set **`tish.trace.server`** to `verbose` to confirm `textDocument/definition` / `textDocument/hover` requests in the output channel.

**Lint vs format:** Red/yellow squiggles are **diagnostics** (parse + `tish-lint`). **Format document** / format-on-save uses **`tish_fmt`** and is lossy (comments removed). Keep format-on-save off unless you want normalized code.

- **Language server** — No manual install, no download: the `tish-lsp` binary for your OS/arch ships inside the platform-specific `.vsix`.
- **`tish` on PATH** — Only if you use **Run/Compile** tasks.
- Custom builds: set **`tish.languageServerPath`** to your own `tish-lsp`, or put one on PATH.

### `spawn tish-lsp ENOENT` / LSP won’t start

The bundled `tish-lsp` (`server/tish-lsp` inside the extension) couldn’t run. Common causes:

1. **Wrong-platform `.vsix`** — Install from the Marketplace / Open VSX, which serve the platform-specific build automatically. Installing a `.vsix` for another OS/arch by hand ships the wrong binary.
2. **Unsupported OS/arch** — If there’s no bundled binary for your platform, set **`tish.languageServerPath`** to a `tish-lsp` you built or installed (`npm i -g @tishlang/tish-lsp`), then **Reload Window**.
3. **Override points nowhere** — If you set `tish.languageServerPath`, make sure it’s an existing, runnable `tish-lsp`.

## Extension maintainers (this repo)

- Bump the **`@tishlang/tish-lsp`** devDependency in `package.json` to ship a newer language server, then `npm i`. CI builds one platform-specific `.vsix` per target, each bundling that platform’s `tish-lsp` (staged from the npm package by `scripts/stage-lsp.cjs` via `TISH_LSP_TARGET`).
- The binary is **bundled, not downloaded** — there is no runtime fetch.

## Configuration

| Setting | Description |
|---------|-------------|
| `tish.languageServerPath` | Path to a `tish-lsp` that overrides the bundled one |
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
