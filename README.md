# Tish — VS Code / Cursor extension

Syntax highlighting, snippets, **tish-lsp** (downloaded automatically), and build tasks for the [Tish](https://github.com/tishlang/tish) language.

## Features

| Feature | Details |
|---------|---------|
| **Languages** | `.tish`, `.tishx` (JSX-oriented grammar) |
| **Snippets** | `fn`, `afn`, `for`, `try`, `import`, … |
| **LSP** | First launch downloads `tish-lsp` from **Tish GitHub Releases** (cached). Optional PATH / custom path. |
| **Tasks** | Example tasks: run file, native compile (see below) |
| **Problem matchers** | `tish-compile`, `tish-rustc` for compile output |

## End users

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
      "label": "tish: compile (native)",
      "type": "shell",
      "command": "tish",
      "args": ["compile", "${file}", "--output", "${workspaceFolder}/tish_out", "--target", "native"],
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

## CI / publishing

Same pattern as [tish](https://github.com/tishlang/tish): CI workflow plus separate release workflows per registry.

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **`vscode-ci.yml`** | push/PR to main, workflow_dispatch | Build VSIX, release_check (conventional commits), create prerelease with tish.vsix. Mirrors build-npm-binaries.yml. |
| **`vscode-release.yml`** | release published/edited | When prerelease promoted to full: download VSIX from release, publish to **Visual Studio Marketplace**. Mirrors npm-release.yml. |
| **`open-vsx-release.yml`** | release published/edited | Same trigger: download VSIX, publish to **[Open VSX](https://open-vsx.org/)** (VSCodium, etc.). |

1. **`VSCE_PAT`** — Visual Studio Marketplace (`vscode-release`).
2. **`OPEN_VSX_TOKEN`** — Open VSX ([create token](https://open-vsx.org/user-settings/tokens); sign publisher agreement first).
3. **Conventional commits** — feat/fix/perf/BREAKING CHANGE required for main merge.
4. Align **`tishLsp.releaseTag`** with Tish’s GitHub release that ships `tish-lsp` binaries.
