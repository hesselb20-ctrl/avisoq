// Vow for VS Code: compiler diagnostics on open and save, and document formatting.
// No dependencies: it runs the Vow compiler that lives in the workspace.
const vscode = require('vscode');
const { execFile } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function compilerRoot() {
  const configured = vscode.workspace.getConfiguration('vow').get('compilerPath');
  const candidates = [
    configured,
    ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath),
    path.resolve(__dirname, '..', '..'),
  ].filter(Boolean);
  return candidates.find((dir) => existsSync(path.join(dir, 'src', 'cli.mjs'))) ?? null;
}

function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection('vow');
  context.subscriptions.push(collection);

  function check(document) {
    if (document.languageId !== 'vow' || document.uri.scheme !== 'file') return;
    const root = compilerRoot();
    if (!root) return;
    const node = vscode.workspace.getConfiguration('vow').get('nodePath') || 'node';
    const file = document.uri.fsPath;
    execFile(node, [path.join(root, 'src', 'cli.mjs'), 'check', file, '--json'], { cwd: path.dirname(file), timeout: 20000 }, (error, stdout) => {
      let result;
      try { result = JSON.parse(stdout); } catch { return; }
      const here = [];
      for (const d of result.diagnostics ?? []) {
        // Errors located in an imported module are shown at the top of this file.
        const elsewhere = d.file && path.resolve(d.file) !== path.resolve(file);
        const line = elsewhere ? 0 : Math.max(0, d.line - 1), col = elsewhere ? 0 : Math.max(0, d.col - 1);
        const end = elsewhere ? 1 : document.lineAt(Math.min(line, document.lineCount - 1)).range.end.character;
        const diag = new vscode.Diagnostic(
          new vscode.Range(line, col, line, Math.max(end, col + 1)),
          `${d.message}${d.hint ? `\nhint: ${d.hint}` : ''}${elsewhere ? `\n(in ${d.file}:${d.line})` : ''}`,
          vscode.DiagnosticSeverity.Error,
        );
        diag.code = d.code;
        diag.source = 'vow';
        here.push(diag);
      }
      collection.set(document.uri, here);
    });
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(check),
    vscode.workspace.onDidSaveTextDocument(check),
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri)),
    vscode.languages.registerDocumentFormattingEditProvider('vow', {
      async provideDocumentFormattingEdits(document) {
        const root = compilerRoot();
        if (!root) return [];
        try {
          const { format, shape } = await import(pathToFileURL(path.join(root, 'src', 'format.mjs')).href);
          const text = document.getText();
          const formatted = format(text);
          if (shape(formatted) !== shape(text)) return []; // never apply an edit that would change the program
          const whole = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
          return [vscode.TextEdit.replace(whole, formatted)];
        } catch {
          return []; // the file does not parse yet; the diagnostics already say why
        }
      },
    }),
  );
  for (const doc of vscode.workspace.textDocuments) check(doc);
}

function deactivate() {}

module.exports = { activate, deactivate };
