import * as path from "path";

/** Platform id for release asset names, e.g. tish-lsp-darwin-arm64 */
export function platformServerId(): string | undefined {
  const plat = process.platform;
  const arch = process.arch;
  if (plat === "darwin") {
    return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  }
  if (plat === "linux") {
    if (arch === "arm64") return "linux-arm64";
    if (arch === "x64") return "linux-x64";
    return undefined;
  }
  if (plat === "win32") {
    if (arch === "arm64") return "win32-arm64";
    if (arch === "x64" || arch === "ia32") return "win32-x64";
    return "win32-x64";
  }
  return undefined;
}

export function isProbablyPath(s: string): boolean {
  return (
    s.includes(path.sep) ||
    (process.platform === "win32" && /^[a-zA-Z]:\\/.test(s))
  );
}
