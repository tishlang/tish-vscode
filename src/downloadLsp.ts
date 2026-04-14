import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { extLog } from "./extDebug";
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
    "(2) install tish-lsp and put it on your PATH, " +
    "(3) set Tish › Language Server Path (tish.languageServerPath) to the binary, or " +
    "(4) when hacking this extension, set env TISH_LANGUAGE_SERVER_PATH or build " +
    "`tishlang_lsp` in a sibling `../tish` repo (see Run Extension launch configs)."
  );
}

const binName = process.platform === "win32" ? "tish-lsp.exe" : "tish-lsp";

/** Non-config override for launch.json / CI (checked after workspace `languageServerPath`). */
function languageServerPathFromEnv(): string | undefined {
  const raw = process.env.TISH_LANGUAGE_SERVER_PATH?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

/**
 * In extension development, use a locally built binary from a sibling checkout of
 * the compiler repo (`tish-vscode` next to `tish`) so F5 works without GitHub assets.
 */
function languageServerPathSiblingDev(
  context: vscode.ExtensionContext,
  diag: vscode.OutputChannel
): string | undefined {
  if (context.extensionMode !== vscode.ExtensionMode.Development) {
    extLog(diag, "sibling dev: skip (not ExtensionMode.Development)", {
      extensionMode: context.extensionMode,
    });
    return undefined;
  }
  const base = path.join(context.extensionPath, "..", "tish", "target");
  for (const profile of ["debug", "release"]) {
    const p = path.join(base, profile, binName);
    const exists = fs.existsSync(p);
    extLog(diag, "sibling dev: candidate", { profile, path: p, exists });
    if (exists) {
      return p;
    }
  }
  extLog(diag, "sibling dev: no binary under ../tish/target/{debug,release}", { base });
  return undefined;
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
  return binName === "tish-lsp.exe"
    ? `tish-lsp-${platformId}.exe`
    : `tish-lsp-${platformId}`;
}

function releaseDownloadUrl(repo: string, tag: string, baseName: string): string {
  return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(baseName)}`;
}

/**
 * Resolution order: workspace `languageServerPath` → `TISH_LANGUAGE_SERVER_PATH` →
 * sibling `../tish/target/{debug,release}/tish-lsp` (extension dev only) → GitHub download
 * (if enabled) → `tish-lsp` on PATH.
 */
export async function resolveLanguageServerExecutable(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
  log: vscode.OutputChannel,
  diag: vscode.OutputChannel
): Promise<string> {
  extLog(
    diag,
    "resolve: order is languageServerPath → TISH_LANGUAGE_SERVER_PATH → sibling dev → download → PATH",
    {}
  );

  const custom = config.get<string>("languageServerPath")?.trim();
  if (custom) {
    extLog(diag, "resolve: branch languageServerPath", { custom, exists: fs.existsSync(custom) });
    if (!fs.existsSync(custom)) {
      throw new Error(
        `tish.languageServerPath does not exist: ${custom}. Fix the path or clear the setting.`
      );
    }
    return custom;
  }

  const fromEnv = languageServerPathFromEnv();
  if (fromEnv) {
    extLog(diag, "resolve: branch TISH_LANGUAGE_SERVER_PATH", { fromEnv, exists: fs.existsSync(fromEnv) });
    if (!fs.existsSync(fromEnv)) {
      throw new Error(
        `TISH_LANGUAGE_SERVER_PATH does not exist: ${fromEnv}. Unset it or point it at a built tish-lsp binary.`
      );
    }
    log.appendLine(`Using tish-lsp from TISH_LANGUAGE_SERVER_PATH: ${fromEnv}`);
    return fromEnv;
  }

  const sibling = languageServerPathSiblingDev(context, diag);
  if (sibling) {
    log.appendLine(`Using tish-lsp from sibling compiler repo (extension dev): ${sibling}`);
    return sibling;
  }

  const dl = config.get<boolean>("languageServerDownload.enable") ?? true;
  const platformId = platformServerId();
  extLog(diag, "resolve: download / PATH gate", { dl, platformId });
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

    extLog(diag, "resolve: download branch", { repo, tag, base, cacheDir, dest, cacheHit: fs.existsSync(dest) });

    if (fs.existsSync(dest)) {
      if (process.platform !== "win32") {
        try {
          fs.chmodSync(dest, 0o755);
        } catch {
          /* ignore */
        }
      }
      extLog(diag, "resolve: using cached download binary", { dest });
      return dest;
    }

    const urlOverride = config.get<string>("languageServerDownload.url")?.trim();
    const url = urlOverride || releaseDownloadUrl(repo, tag, base);
    log.appendLine(`Downloading tish-lsp: ${url}`);
    extLog(diag, "resolve: fetching release asset", { url, hasUrlOverride: Boolean(urlOverride) });

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
                ? " No file at that URL (missing release/tag, private repo, or binaries not uploaded). Build tish-lsp from the Tish compiler repo (cargo build -p tishlang_lsp), set tish.languageServerPath, set tish.languageServerDownload.url to a direct URL, or use launch \"Run Extension (rebuild local tish-lsp)\" when ../tish is a sibling checkout. See docs/lsp-release-assets.md for release asset names."
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

    extLog(diag, "resolve: download finished; using binary", { dest });
    return dest;
  } else {
    extLog(diag, "resolve: skipping GitHub download branch", { dl, platformId });
  }

  const onPath = tishLspOnPath();
  extLog(diag, "resolve: trying PATH which", { onPath: onPath ?? null });
  if (onPath) {
    log.appendLine(`Using tish-lsp from PATH: ${onPath}`);
    return onPath;
  }
  extLog(diag, "resolve: no tish-lsp found; throwing", {});
  throw new Error(missingTishLspMessage());
}
