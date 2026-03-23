"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLanguageServerExecutable = resolveLanguageServerExecutable;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const serverPath_1 = require("./serverPath");
/** Resolve `tish-lsp` to an absolute path when it exists on PATH (spawn is more reliable). */
function tishLspOnPath() {
    const isWin = process.platform === "win32";
    try {
        const out = (0, child_process_1.execFileSync)(isWin ? "where" : "which", ["tish-lsp"], {
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
    }
    catch {
        /* not on PATH */
    }
    return undefined;
}
function missingTishLspMessage() {
    return ("tish-lsp was not found. Either: (1) turn ON " +
        '"Tish › Language Server Download: Enable" (tish.languageServerDownload.enable) and reload the window, ' +
        "(2) install tish-lsp and put it on your PATH, or " +
        "(3) set Tish › Language Server Path (tish.languageServerPath) to the binary.");
}
function readManifest() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require("../package.json");
    return {
        downloadRepo: pkg.tishLsp?.downloadRepo ?? "tishlang/tish",
        releaseTag: pkg.tishLsp?.releaseTag ?? "v0.1.0",
    };
}
function assetBaseName(platformId) {
    return process.platform === "win32"
        ? `tish-lsp-${platformId}.exe`
        : `tish-lsp-${platformId}`;
}
function releaseDownloadUrl(repo, tag, baseName) {
    return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(baseName)}`;
}
/**
 * Override path → cached download → `tish-lsp` on PATH.
 */
async function resolveLanguageServerExecutable(context, config, log) {
    const custom = config.get("languageServerPath")?.trim();
    if (custom) {
        if (!fs.existsSync(custom)) {
            throw new Error(`tish.languageServerPath does not exist: ${custom}. Fix the path or clear the setting.`);
        }
        return custom;
    }
    const dl = config.get("languageServerDownload.enable") ?? true;
    const platformId = (0, serverPath_1.platformServerId)();
    if (dl && platformId) {
        const tag = config.get("languageServerDownload.releaseTag")?.trim() ||
            readManifest().releaseTag;
        const repo = config.get("languageServerDownload.repo")?.trim() ||
            readManifest().downloadRepo;
        const base = assetBaseName(platformId);
        const cacheDir = path.join(context.globalStorageUri.fsPath, "tish-lsp", tag);
        const dest = path.join(cacheDir, process.platform === "win32" ? "tish-lsp.exe" : "tish-lsp");
        if (fs.existsSync(dest)) {
            if (process.platform !== "win32") {
                try {
                    fs.chmodSync(dest, 0o755);
                }
                catch {
                    /* ignore */
                }
            }
            return dest;
        }
        const urlOverride = config.get("languageServerDownload.url")?.trim();
        const url = urlOverride || releaseDownloadUrl(repo, tag, base);
        log.appendLine(`Downloading tish-lsp: ${url}`);
        const ac = new AbortController();
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Tish: downloading language server (one-time)",
            cancellable: true,
        }, async (progress, token) => {
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
                    const hint404 = res.status === 404
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
            }
            catch (e) {
                await fs.promises.unlink(tmp).catch(() => undefined);
                throw e;
            }
            finally {
                sub.dispose();
            }
        });
        return dest;
    }
    const onPath = tishLspOnPath();
    if (onPath) {
        log.appendLine(`Using tish-lsp from PATH: ${onPath}`);
        return onPath;
    }
    throw new Error(missingTishLspMessage());
}
