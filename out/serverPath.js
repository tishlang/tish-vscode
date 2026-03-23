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
exports.platformServerId = platformServerId;
exports.isProbablyPath = isProbablyPath;
const path = __importStar(require("path"));
/** Platform id for release asset names, e.g. tish-lsp-darwin-arm64 */
function platformServerId() {
    const plat = process.platform;
    const arch = process.arch;
    if (plat === "darwin") {
        return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
    }
    if (plat === "linux") {
        if (arch === "arm64")
            return "linux-arm64";
        if (arch === "x64")
            return "linux-x64";
        return undefined;
    }
    if (plat === "win32") {
        if (arch === "arm64")
            return "win32-arm64";
        if (arch === "x64" || arch === "ia32")
            return "win32-x64";
        return "win32-x64";
    }
    return undefined;
}
function isProbablyPath(s) {
    return (s.includes(path.sep) ||
        (process.platform === "win32" && /^[a-zA-Z]:\\/.test(s)));
}
