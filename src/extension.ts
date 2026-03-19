import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { resolveLanguageServerExecutable } from "./downloadLsp";
import { isProbablyPath } from "./serverPath";

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel("Tish Language Server");
  context.subscriptions.push(log);

  const config = vscode.workspace.getConfiguration("tish");

  void (async () => {
    let serverExec: string;
    try {
      serverExec = await resolveLanguageServerExecutable(context, config, log);
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : `Language server setup failed: ${String(e)}`;
      void vscode.window.showErrorMessage(`Tish: ${msg}`);
      return;
    }

    log.appendLine(`Using language server: ${serverExec}`);

    const serverOptions: ServerOptions = {
      run: {
        command: serverExec,
        transport: TransportKind.stdio,
      },
      debug: {
        command: serverExec,
        transport: TransportKind.stdio,
        args: [],
      },
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: "file", language: "tish" },
        { scheme: "file", language: "tish-jsx" },
      ],
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher("**/*.tish"),
      },
      outputChannel: log,
    };

    client = new LanguageClient(
      "tishLanguageServer",
      "Tish Language Server",
      serverOptions,
      clientOptions
    );

    client.start().catch((err) => {
      const hint =
        serverExec === "tish-lsp" || !isProbablyPath(serverExec)
          ? `Install tish-lsp on PATH or set tish.languageServerPath.`
          : `Check tish.languageServerPath.`;
      void vscode.window.showWarningMessage(
        `Tish LSP failed to start. ${hint} ${String(err)}`
      );
    });

    context.subscriptions.push(client);
  })();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("tish")) {
        void vscode.window.showInformationMessage(
          "Reload the window for Tish language server settings to take effect."
        );
      }
    })
  );

  const fmt = vscode.workspace.getConfiguration("tish").get<boolean>("format.enable");
  if (fmt) {
    context.subscriptions.push(
      vscode.workspace.onWillSaveTextDocument((e) => {
        if (
          e.document.languageId === "tish" ||
          e.document.languageId === "tish-jsx"
        ) {
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.document === e.document) {
            e.waitUntil(
              vscode.commands
                .executeCommand("editor.action.formatDocument")
                .then(
                  () => undefined,
                  () => undefined
                )
            );
          }
        }
      })
    );
  }
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
