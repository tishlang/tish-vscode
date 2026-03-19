import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { platformServerId } from "./serverPath";

/** Resolve `tish-lsp` to an absolute path when it exists on PATH (spawn is more reliable). */
function tishLspOnPath(): string | undefined {
  const isWin = process.platform === "win32";
  try {
    const out = execFileSync(isWin ? "where" : "which", ["tish-lsp"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    const line = out
      .trim()
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .find((s) => s.length > 0);
    if (line && fs.existsSync(line)) {
      return line;
    }
  } catch {
    /* not on PATH */
  }
  return undefined;
}

function missingTishLspMessage(): string {
  return (
    "tish-lsp was not found. Either: (1) turn ON " +
    '"Tish › Language Server Download: Enable" (tish.languageServerDownload.enable) and reload the window, ' +
    "(2) install tish-lsp and put it on your PATH, or " +
    "(3) set Tish › Language Server Path (tish.languageServerPath) to the binary."
  );
}

export interface TishLspManifest {
  downloadRepo: string;
  releaseTag: string;
}

function readManifest(): TishLspManifest {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require("../package.json") as {
    tishLsp?: Partial<TishLspManifest>;
  };
  return {
    downloadRepo: pkg.tishLsp?.downloadRepo ?? "tishlang/tish",
    releaseTag: pkg.tishLsp?.releaseTag ?? "v0.1.0",
  };
}

function assetBaseName(platformId: string): string {
  return process.platform === "win32"
    ? `tish-lsp-${platformId}.exe`
    : `tish-lsp-${platformId}`;
}

function releaseDownloadUrl(repo: string, tag: string, baseName: string): string {
  return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(baseName)}`;
}

/**
 * Override path → cached download → `tish-lsp` on PATH.
 */
export async function resolveLanguageServerExecutable(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
  log: vscode.OutputChannel
): Promise<string> {
  const custom = config.get<string>("languageServerPath")?.trim();
  if (custom) {
    if (!fs.existsSync(custom)) {
      throw new Error(
        `tish.languageServerPath does not exist: ${custom}. Fix the path or clear the setting.`
      );
    }
    return custom;
  }

  const dl = config.get<boolean>("languageServerDownload.enable") ?? true;
  const platformId = platformServerId();
  if (dl && platformId) {
    const tag =
      config.get<string>("languageServerDownload.releaseTag")?.trim() ||
      readManifest().releaseTag;
    const repo =
      config.get<string>("languageServerDownload.repo")?.trim() ||
      readManifest().downloadRepo;
    const base = assetBaseName(platformId);
    const cacheDir = path.join(context.globalStorageUri.fsPath, "tish-lsp", tag);
    const dest = path.join(
      cacheDir,
      process.platform === "win32" ? "tish-lsp.exe" : "tish-lsp"
    );

    if (fs.existsSync(dest)) {
      if (process.platform !== "win32") {
        try {
          fs.chmodSync(dest, 0o755);
        } catch {
          /* ignore */
        }
      }
      return dest;
    }

    const urlOverride = config.get<string>("languageServerDownload.url")?.trim();
    const url = urlOverride || releaseDownloadUrl(repo, tag, base);
    log.appendLine(`Downloading tish-lsp: ${url}`);

    const ac = new AbortController();
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Tish: downloading language server (one-time)",
        cancellable: true,
      },
      async (progress, token) => {
        const sub = token.onCancellationRequested(() => ac.abort());
        const tmp = `${dest}.part`;
        try {
          progress.report({ message: "Fetching…" });
          const res = await fetch(url, {
            signal: ac.signal,
            redirect: "follow",
            headers: { "User-Agent": "tish-vscode-extension" },
          });
          if (!res.ok) {
            const baseMsg = `HTTP ${res.status}: could not download "${base}" from https://github.com/${repo}/releases/tag/${tag}`;
            const hint404 =
              res.status === 404
                ? " No file at that URL (missing release/tag, private repo, or binaries not uploaded). Build tish-lsp from the Tish compiler repo, set setting tish.languageServerPath to that binary, or tish.languageServerDownload.url to a direct download. See docs/lsp-release-assets.md for release asset names."
                : "";
            throw new Error(baseMsg + "." + hint404);
          }
          const buf = Buffer.from(await res.arrayBuffer());
          progress.report({ message: "Installing…" });
          await fs.promises.mkdir(cacheDir, { recursive: true });
          await fs.promises.writeFile(tmp, buf);
          await fs.promises.rename(tmp, dest);
          if (process.platform !== "win32") {
            fs.chmodSync(dest, 0o755);
          }
        } catch (e) {
          await fs.promises.unlink(tmp).catch(() => undefined);
          throw e;
        } finally {
          sub.dispose();
        }
      }
    );

    return dest;
  }

  const onPath = tishLspOnPath();
  if (onPath) {
    log.appendLine(`Using tish-lsp from PATH: ${onPath}`);
    return onPath;
  }
  throw new Error(missingTishLspMessage());
}
