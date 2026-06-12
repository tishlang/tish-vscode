import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { extLog } from "./extDebug";

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
    "tish-lsp was not found. It is normally bundled with the extension (server/tish-lsp). " +
    "If this build is missing it (an unsupported OS/arch, or a dev build), either set " +
    '"Tish › Language Server Path" (tish.languageServerPath) to a tish-lsp binary, put tish-lsp on ' +
    "PATH, or install one with: npm i -g @tishlang/tish-lsp."
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
 * the compiler repo (`tish-vscode` next to `tish`) so F5 works against your own build.
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
  // Build extension-relative paths with VS Code's Uri API (not Node path.join on the extension dir).
  for (const profile of ["debug", "release"]) {
    const p = vscode.Uri.joinPath(context.extensionUri, "..", "tish", "target", profile, binName).fsPath;
    const exists = fs.existsSync(p);
    extLog(diag, "sibling dev: candidate", { profile, path: p, exists });
    if (exists) {
      return p;
    }
  }
  extLog(diag, "sibling dev: no binary under ../tish/target/{debug,release}", {
    base: vscode.Uri.joinPath(context.extensionUri, "..", "tish", "target").fsPath,
  });
  return undefined;
}

/**
 * Resolve the tish-lsp executable. The binary is **bundled** with the extension — each
 * platform-specific .vsix ships `server/tish-lsp(.exe)`, staged from the pinned
 * `@tishlang/tish-lsp` npm devDependency at build time. No download, no compiler required.
 *
 * Resolution order: workspace `languageServerPath` → `TISH_LANGUAGE_SERVER_PATH` (only if that file
 * exists) → sibling `../tish/target/.../tish-lsp` (extension Development host only) → the bundled
 * `server/tish-lsp` → `tish-lsp` on PATH.
 */
export async function resolveLanguageServerExecutable(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
  log: vscode.OutputChannel,
  diag: vscode.OutputChannel
): Promise<string> {
  extLog(
    diag,
    "resolve: order is languageServerPath → TISH_LANGUAGE_SERVER_PATH (if exists) → sibling dev → bundled → PATH",
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
      `Tish: TISH_LANGUAGE_SERVER_PATH is set but file is missing (${fromEnv}); using the bundled server / PATH.`
    );
    extLog(diag, "resolve: TISH_LANGUAGE_SERVER_PATH missing on disk; fall through", { fromEnv });
  }

  const sibling = languageServerPathSiblingDev(context, diag);
  if (sibling) {
    log.appendLine(`Using tish-lsp from sibling compiler repo (extension dev): ${sibling}`);
    return sibling;
  }

  // Bundled binary: server/tish-lsp(.exe) shipped inside this platform-specific .vsix. Built with
  // VS Code's Uri API (not Node path.join on the extension dir); binName is a fixed constant.
  const bundled = vscode.Uri.joinPath(context.extensionUri, "server", binName).fsPath;
  extLog(diag, "resolve: branch bundled binary", { bundled, exists: fs.existsSync(bundled) });
  if (fs.existsSync(bundled)) {
    if (process.platform !== "win32") {
      try {
        fs.chmodSync(bundled, 0o755);
      } catch {
        /* ignore */
      }
    }
    log.appendLine(`Using bundled tish-lsp: ${bundled}`);
    return bundled;
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
