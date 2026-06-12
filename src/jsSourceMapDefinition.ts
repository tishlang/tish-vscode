import * as path from "path";
import * as vscode from "vscode";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";

function asLocation(loc: vscode.Location | vscode.LocationLink): vscode.Location {
  if ("targetUri" in loc) {
    const r = loc.targetSelectionRange ?? loc.targetRange;
    return new vscode.Location(loc.targetUri, r);
  }
  return loc;
}

async function readSiblingSourceMap(jsUri: vscode.Uri): Promise<unknown | null> {
  const mapUri = jsUri.with({ path: jsUri.path + ".map" });
  try {
    const buf = await vscode.workspace.fs.readFile(mapUri);
    const text = Buffer.from(buf).toString("utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function remapGeneratedToTishAsync(
  jsUri: vscode.Uri,
  genLine: number,
  genCol: number
): Promise<vscode.Location | null> {
  const raw = await readSiblingSourceMap(jsUri);
  if (raw === null || typeof raw !== "object" || raw === null) {
    return null;
  }
  const tracer = new TraceMap(raw as never);
  const pos = originalPositionFor(tracer, { line: genLine, column: genCol });
  if (pos.source == null || pos.line == null || pos.column == null) {
    return null;
  }
  const src = pos.source;
  if (!src.endsWith(".tish")) {
    return null;
  }
  const abs = path.resolve(path.dirname(jsUri.fsPath), src);
  return new vscode.Location(vscode.Uri.file(abs), new vscode.Position(pos.line, pos.column));
}

/**
 * When TypeScript/JavaScript "go to definition" lands on emitted `.js` under `node_modules`,
 * remap through an adjacent `.js.map` (e.g. from `tish build --target js --source-map`) so
 * navigation opens the original `.tish` instead of transpiled JS.
 */
export function registerJsSourceMapDefinition(context: vscode.ExtensionContext): void {
  const sel: vscode.DocumentSelector = [
    { scheme: "file", language: "javascript" },
    { scheme: "file", language: "javascriptreact" },
    { scheme: "file", language: "typescript" },
    { scheme: "file", language: "typescriptreact" },
  ];
  const provider: vscode.DefinitionProvider = {
    async provideDefinition(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
      try {
        const base = await vscode.commands.executeCommand<unknown>(
          "vscode.executeDefinitionProvider",
          document.uri,
          position
        );
        if (!Array.isArray(base) || base.length === 0) {
          return null;
        }
        const out: vscode.Location[] = [];
        for (const item of base) {
          if (!item || typeof item !== "object") {
            continue;
          }
          const loc = asLocation(item as vscode.Location | vscode.LocationLink);
          const p = loc.uri.fsPath;
          const isEmitted =
            p.endsWith(".js") || p.endsWith(".mjs") || p.endsWith(".cjs");
          if (!isEmitted) {
            out.push(loc);
            continue;
          }
          const mapped = await remapGeneratedToTishAsync(loc.uri, loc.range.start.line, loc.range.start.character);
          out.push(mapped ?? loc);
        }
        return out.length ? out : null;
      } catch {
        return null;
      }
    },
  };
  context.subscriptions.push(vscode.languages.registerDefinitionProvider(sel, provider));
}
