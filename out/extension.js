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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const node_1 = require("vscode-languageclient/node");
const downloadLsp_1 = require("./downloadLsp");
const serverPath_1 = require("./serverPath");
let client;
function activate(context) {
    const log = vscode.window.createOutputChannel("Tish Language Server");
    context.subscriptions.push(log);
    const config = vscode.workspace.getConfiguration("tish");
    void (async () => {
        let serverExec;
        try {
            serverExec = await (0, downloadLsp_1.resolveLanguageServerExecutable)(context, config, log);
        }
        catch (e) {
            const msg = e instanceof Error && e.message
                ? e.message
                : `Language server setup failed: ${String(e)}`;
            void vscode.window.showErrorMessage(`Tish: ${msg}`);
            return;
        }
        log.appendLine(`Using language server: ${serverExec}`);
        const serverOptions = {
            run: {
                command: serverExec,
                transport: node_1.TransportKind.stdio,
            },
            debug: {
                command: serverExec,
                transport: node_1.TransportKind.stdio,
                args: [],
            },
        };
        const clientOptions = {
            documentSelector: [
                { scheme: "file", language: "tish" },
                { scheme: "file", language: "tish-jsx" },
            ],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher("**/*.tish"),
            },
            outputChannel: log,
        };
        client = new node_1.LanguageClient("tishLanguageServer", "Tish Language Server", serverOptions, clientOptions);
        client.start().catch((err) => {
            const hint = serverExec === "tish-lsp" || !(0, serverPath_1.isProbablyPath)(serverExec)
                ? `Install tish-lsp on PATH or set tish.languageServerPath.`
                : `Check tish.languageServerPath.`;
            void vscode.window.showWarningMessage(`Tish LSP failed to start. ${hint} ${String(err)}`);
        });
        context.subscriptions.push(client);
    })();
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("tish")) {
            void vscode.window.showInformationMessage("Reload the window for Tish language server settings to take effect.");
        }
    }));
    const fmt = vscode.workspace.getConfiguration("tish").get("format.enable");
    if (fmt) {
        context.subscriptions.push(vscode.workspace.onWillSaveTextDocument((e) => {
            if (e.document.languageId === "tish" ||
                e.document.languageId === "tish-jsx") {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document === e.document) {
                    e.waitUntil(vscode.commands
                        .executeCommand("editor.action.formatDocument")
                        .then(() => undefined, () => undefined));
                }
            }
        }));
    }
}
function deactivate() {
    return client?.stop();
}
