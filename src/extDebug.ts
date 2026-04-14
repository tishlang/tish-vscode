import * as vscode from "vscode";

const SECTION = "tish";
const KEY = "debug.extension";

export function extensionDebugEnabled(): boolean {
  return vscode.workspace.getConfiguration(SECTION).get<boolean>(KEY) === true;
}

/**
 * When `tish.debug.extension` is true, append one timestamped line to the “Tish Extension” diagnostics channel (caller supplies that channel).
 * Use `data` for small JSON-safe fields (paths, flags); avoid huge strings.
 */
export function extLog(log: vscode.OutputChannel, message: string, data?: Record<string, unknown>): void {
  if (!extensionDebugEnabled()) {
    return;
  }
  const ts = new Date().toISOString();
  let line = `[tish-ext ${ts}] ${message}`;
  if (data && Object.keys(data).length > 0) {
    try {
      line += ` ${JSON.stringify(data)}`;
    } catch {
      line += " [data: not JSON-serializable]";
    }
  }
  log.appendLine(line);
}
