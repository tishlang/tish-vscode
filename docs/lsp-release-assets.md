# tish-lsp release assets (Tish compiler repo)

The VS Code extension downloads **pre-built** `tish-lsp` from GitHub Releases.  
Rust builds stay in the **Tish** repo only; this extension repo never compiles Rust.

## Required files per release tag

Attach these as **release assets** (raw executables, not inside a zip), same tag the extension pins in `package.json` → `tishLsp.releaseTag`:

| Asset filename | Platform |
|----------------|----------|
| `tish-lsp-darwin-arm64` | macOS Apple Silicon |
| `tish-lsp-darwin-x64` | macOS Intel |
| `tish-lsp-linux-arm64` | Linux ARM64 |
| `tish-lsp-linux-x64` | Linux x64 |
| `tish-lsp-win32-x64.exe` | Windows x64 |
| `tish-lsp-win32-arm64.exe` | Windows ARM64 (optional) |

URL shape:

`https://github.com/<owner>/<repo>/releases/download/<tag>/<filename>`

## CI idea (Tish repo only)

On each Tish release, build `tish_lsp` per target (matrix or cross-compile) and upload the six files above. The vscode extension only bumps `tishLsp.releaseTag` to match.
