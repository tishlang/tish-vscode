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
    "tish-lsp was not found. The extension is meant to download it automatically. Try: " +
    '(1) enable "Tish › Language Server Download: Enable" (tish.languageServerDownload.enable), then Reload Window; ' +
    "(2) set tish.languageServerDownload.url to a direct binary URL if your network blocks GitHub; " +
    '(3) set "Tish › Language Server Path" (tish.languageServerPath) to a prebuilt tish-lsp you obtained from GitHub Releases; ' +
    "(4) put a working tish-lsp on PATH as a last resort."
  );
}

const binName = process.platform === "win32" ? "tish-lsp.exe" : "tish-lsp";

/**
 * Expand VS Code-style workspace placeholders in settings values (`tish.languageServerPath`,
 * `tish.tishlangSourceRoot`). Supports `${workspaceFolder}` and `${workspaceFolder:Name}` for
 * multi-root workspaces (`.code-workspace` `folders[].name`).
 */
export function expandWorkspaceVariablesInPath(raw: string): string {
  if (!raw.includes("${")) {
    return raw;
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  let s = raw;
  for (const f of folders) {
    const label = f.name;
    if (label?.length) {
      const token = "${workspaceFolder:" + label + "}";
      s = s.split(token).join(f.uri.fsPath);
    }
  }
  if (folders[0]) {
    s = s.split("${workspaceFolder}").join(folders[0].uri.fsPath);
  }
  if (s.includes("${")) {
    throw new Error(
      `Unresolved workspace placeholder in path: "${raw}". For multi-root, use \${workspaceFolder:YourFolderName} matching "name" in the .code-workspace file, or open a single folder.`
    );
  }
  return path.resolve(s);
}

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
    releaseTag: pkg.tishLsp?.releaseTag ?? "v2.0.3",
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
 * Resolution order (end users rely on GitHub download; no compiler build required):
 * workspace `languageServerPath` → `TISH_LANGUAGE_SERVER_PATH` (only if that file exists;
 * missing env path is ignored so download can run) → sibling `../tish/target/.../tish-lsp`
 * (extension Development host only) → GitHub download (cache + fetch when enabled) →
 * `tish-lsp` on PATH.
 */
export async function resolveLanguageServerExecutable(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
  log: vscode.OutputChannel,
  diag: vscode.OutputChannel
): Promise<string> {
  extLog(
    diag,
    "resolve: order is languageServerPath → TISH_LANGUAGE_SERVER_PATH (if exists) → sibling dev → download → PATH",
    {}
  );

  const custom = config.get<string>("languageServerPath")?.trim();
  if (custom) {
    const expanded = expandWorkspaceVariablesInPath(custom);
    extLog(diag, "resolve: branch languageServerPath", {
      custom,
      expanded,
      exists: fs.existsSync(expanded),
    });
    if (!fs.existsSync(expanded)) {
      throw new Error(
        `tish.languageServerPath does not exist: ${expanded} (configured as "${custom}"). Fix the path or clear the setting.`
      );
    }
    return expanded;
  }

  const fromEnv = languageServerPathFromEnv();
  if (fromEnv) {
    const envExists = fs.existsSync(fromEnv);
    extLog(diag, "resolve: branch TISH_LANGUAGE_SERVER_PATH", { fromEnv, exists: envExists });
    if (envExists) {
      log.appendLine(`Using tish-lsp from TISH_LANGUAGE_SERVER_PATH: ${fromEnv}`);
      return fromEnv;
    }
    log.appendLine(
      `Tish: TISH_LANGUAGE_SERVER_PATH is set but file is missing (${fromEnv}); continuing with automatic download / PATH.`
    );
    extLog(diag, "resolve: TISH_LANGUAGE_SERVER_PATH missing on disk; fall through", { fromEnv });
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
                ? " No file at that URL (wrong or unpublished release tag, private repo, or assets not uploaded yet). Fix: pick a tag that has `tish-lsp-<platform>` on GitHub Releases, set tish.languageServerDownload.releaseTag / .repo, or set tish.languageServerDownload.url to a direct binary URL. Optionally set tish.languageServerPath to a binary you downloaded by hand. See docs/lsp-release-assets.md for expected asset names."
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
    if (!platformId) {
      log.appendLine(
        "Tish: no prebuilt GitHub asset id for this OS/architecture; automatic download is skipped. Install a matching tish-lsp and set tish.languageServerPath, or use tish.languageServerDownload.url."
      );
    } else if (!dl) {
      log.appendLine(
        'Tish: language server download is disabled (tish.languageServerDownload.enable). Enable it for automatic binaries, or set tish.languageServerPath / PATH.'
      );
    }
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
