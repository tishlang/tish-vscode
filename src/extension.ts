import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { expandWorkspaceVariablesInPath, resolveLanguageServerExecutable } from "./downloadLsp";
import { extLog, extensionDebugEnabled } from "./extDebug";
import { registerJsSourceMapDefinition } from "./jsSourceMapDefinition";
import { isProbablyPath } from "./serverPath";

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel("Tish Language Server");
  context.subscriptions.push(log);
  const extensionDiag = vscode.window.createOutputChannel("Tish Extension");
  context.subscriptions.push(extensionDiag);

  extensionDiag.appendLine("Tish extension activated — this is the “Tish Extension” output (boot + optional [tish-ext …] debug).");
  extensionDiag.appendLine(
    "Turn ON User setting tish.debug.extension (or Command Palette → “Tish: Toggle Extension Debug Logging”) for verbose resolver / LSP-start lines here."
  );
  extensionDiag.appendLine('Separate panel: Output → “Tish Language Server” — download progress, “tish-lsp started”, errors, and tish.trace.server RPC trace.');
  extLog(extensionDiag, "activate: boot", {
    extensionPath: context.extensionPath,
    extensionMode: vscode.ExtensionMode[context.extensionMode],
    debugExtension: extensionDebugEnabled(),
    vscodeVersion: vscode.version,
    workspaceTrust: vscode.workspace.isTrusted,
    workspaceFolderCount: vscode.workspace.workspaceFolders?.length ?? 0,
  });

  log.appendLine(
    'Tish: this channel is for the language server process (downloads, “tish-lsp started”, traces). Extension boot / [tish-ext] debug → Output → “Tish Extension”.'
  );

  registerJsSourceMapDefinition(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("tish.showLanguageServerOutput", () => {
      log.show(true);
      void vscode.window.showInformationMessage(
        'Tish: opened “Tish Language Server”. For resolver / [tish-ext] lines use Output → “Tish Extension”. Look for “tish-lsp started” here; if missing, confirm automatic download is enabled (tish.languageServerDownload.enable), check the log for HTTP errors, then Reload Window.'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tish.showExtensionOutput", () => {
      extensionDiag.show(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tish.toggleExtensionDebug", async () => {
      const conf = vscode.workspace.getConfiguration("tish");
      const next = !(conf.get<boolean>("debug.extension") === true);
      await conf.update("debug.extension", next, vscode.ConfigurationTarget.Global);
      extensionDiag.appendLine(
        `[tish-ext] debug.extension set to ${String(next)} (User settings). ${next ? "Further lines use [tish-ext ISO8601] … until you turn this off." : ""}`
      );
      extensionDiag.show(true);
      void vscode.window.showInformationMessage(
        `Tish extension debug logging: ${next ? "ON — Output → “Tish Extension”" : "OFF"}`
      );
    })
  );
  if (!vscode.workspace.isTrusted) {
    log.appendLine(
      "Workspace is not trusted (Restricted Mode): workspace-level language-server download overrides are ignored; the extension still uses your User settings and the built-in default (download from GitHub Releases). Trust the workspace only if you intentionally want repo-provided download URL/tag overrides."
    );
    extensionDiag.appendLine(
      "Workspace is not trusted (Restricted Mode): workspace-level language-server download overrides are ignored; automatic download still applies from User defaults (see “Tish Language Server” output)."
    );
  }

  const config = vscode.workspace.getConfiguration("tish");

  void (async () => {
    extLog(extensionDiag, "resolveLanguageServerExecutable: begin", {
      hasLanguageServerPath: Boolean(config.get<string>("languageServerPath")?.trim()),
      downloadEnable: config.get<boolean>("languageServerDownload.enable"),
      envTishLanguageServerPath: Boolean(process.env.TISH_LANGUAGE_SERVER_PATH?.trim()),
    });
    let serverExec: string;
    try {
      serverExec = await resolveLanguageServerExecutable(context, config, log, extensionDiag);
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : `Language server setup failed: ${String(e)}`;
      extLog(extensionDiag, "resolveLanguageServerExecutable: threw", {
        message: msg,
        stack: e instanceof Error ? e.stack : undefined,
      });
      log.appendLine(`Tish: language server setup failed — ${msg}`);
      void vscode.window.showErrorMessage(`Tish: ${msg}`);
      return;
    }

    log.appendLine(`Using language server: ${serverExec}`);
    extLog(extensionDiag, "resolveLanguageServerExecutable: success", { serverExec });

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

    let srcRoot = config.get<string>("tishlangSourceRoot")?.trim() ?? "";
    if (srcRoot.length > 0) {
      try {
        srcRoot = expandWorkspaceVariablesInPath(srcRoot);
      } catch (e) {
        extensionDiag.appendLine(
          `Tish: tish.tishlangSourceRoot not applied (${e instanceof Error ? e.message : String(e)}).`
        );
        srcRoot = "";
      }
    }
    const clientOptions: LanguageClientOptions = {
      // `untitled` covers “New file” then language set to Tish; `file` is normal on-disk workspaces.
      documentSelector: [
        { scheme: "file", language: "tish" },
        { scheme: "untitled", language: "tish" },
      ],
      initializationOptions:
        srcRoot.length > 0 ? { tishlangSourceRoot: srcRoot } : undefined,
      synchronize: {
        fileEvents: [vscode.workspace.createFileSystemWatcher("**/*.tish")],
      },
      outputChannel: log,
      revealOutputChannelOn: RevealOutputChannelOn.Error,
      markdown: { isTrusted: true, supportHtml: false },
    };

    client = new LanguageClient(
      "tishLanguageServer",
      "Tish Language Server",
      serverOptions,
      clientOptions
    );
    context.subscriptions.push(client);

    extLog(extensionDiag, "LanguageClient.start: calling", { serverExec });
    void client
      .start()
      .then(() => {
        extLog(extensionDiag, "LanguageClient.start: resolved (process running)", { serverExec });
        log.appendLine(
          "tish-lsp started — go to definition (⌘/Ctrl+click), hover, references, rename, completion."
        );
        log.appendLine(
          "If those are missing, set tish.languageServerDownload.releaseTag to a release that ships tish-lsp for your OS, or tish.languageServerPath to a newer prebuilt binary, then reload."
        );
      })
      .catch((err: unknown) => {
        const hint =
          serverExec === "tish-lsp" || !isProbablyPath(serverExec)
            ? `Ensure automatic download succeeded (Output → Tish Language Server), or set tish.languageServerPath to a prebuilt tish-lsp.`
            : `Check tish.languageServerPath points at a runnable tish-lsp binary.`;
        extLog(extensionDiag, "LanguageClient.start: rejected", {
          message: String(err),
          stack: err instanceof Error ? err.stack : undefined,
          serverExec,
        });
        log.appendLine(`Tish LSP failed to start: ${String(err)}`);
        void vscode.window.showWarningMessage(
          `Tish LSP failed to start. ${hint} ${String(err)}`
        );
      });
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
        if (e.document.languageId === "tish") {
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
