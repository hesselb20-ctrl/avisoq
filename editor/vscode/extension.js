// Avisoq for VS Code: errors while typing, hover, go to definition, completion, outline and
// formatting. No dependencies: it loads the Avisoq compiler that lives in the workspace and
// analyses the text in the editor (saved or not).
const vscode = require('vscode');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function compilerRoot() {
  const configured = vscode.workspace.getConfiguration('avisoq').get('compilerPath');
  const candidates = [
    configured,
    ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath),
    path.resolve(__dirname, '..', '..'),
  ].filter(Boolean);
  return candidates.find((dir) => existsSync(path.join(dir, 'src', 'ide.mjs'))) ?? null;
}

const KIND = {
  variable: vscode.CompletionItemKind.Variable, function: vscode.CompletionItemKind.Function, struct: vscode.CompletionItemKind.Struct,
  enum: vscode.CompletionItemKind.Enum, variant: vscode.CompletionItemKind.EnumMember, keyword: vscode.CompletionItemKind.Keyword,
  type: vscode.CompletionItemKind.Class,
};
const SYMBOL = { Fn: vscode.SymbolKind.Function, Struct: vscode.SymbolKind.Struct, Enum: vscode.SymbolKind.Enum, Test: vscode.SymbolKind.Method };

function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection('avisoq');
  context.subscriptions.push(collection);
  const cache = new Map(); // uri -> { version, info, lastGood }
  let modules = null;

  async function load() {
    const root = compilerRoot();
    if (!root) return null;
    if (!modules || modules.root !== root) {
      const at = (f) => pathToFileURL(path.join(root, 'src', f)).href;
      modules = { root, ide: await import(at('ide.mjs')), fmt: await import(at('format.mjs')) };
    }
    return modules;
  }

  async function analyse(document) {
    if (document.languageId !== 'avisoq') return null;
    const key = document.uri.toString();
    const hit = cache.get(key);
    if (hit && hit.version === document.version) return hit;
    const m = await load();
    if (!m) return null;
    let info;
    try { info = m.ide.inspect(document.getText(), document.uri.scheme === 'file' ? document.uri.fsPath : undefined); } catch { return hit ?? null; }
    const entry = { version: document.version, info, lastGood: info.ok ? info : hit?.lastGood ?? info };
    cache.set(key, entry);
    const file = document.uri.fsPath;
    collection.set(document.uri, info.diagnostics.map((d) => {
      // A problem located in an imported file is shown at the top of this one.
      const elsewhere = d.file && path.resolve(d.file) !== path.resolve(file);
      const line = elsewhere ? 0 : Math.min(Math.max(0, d.line - 1), document.lineCount - 1), col = elsewhere ? 0 : Math.max(0, d.col - 1);
      const end = Math.max(document.lineAt(line).range.end.character, col + 1);
      const diag = new vscode.Diagnostic(new vscode.Range(line, col, line, end),
        `${d.message}${d.hint ? `\nhint: ${d.hint}` : ''}${elsewhere ? `\n(in ${d.file}:${d.line})` : ''}`, vscode.DiagnosticSeverity.Error);
      diag.code = d.code;
      diag.source = 'avisoq';
      return diag;
    }));
    return entry;
  }

  let timer = null;
  const later = (document) => { clearTimeout(timer); timer = setTimeout(() => analyse(document), 250); };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(analyse),
    vscode.workspace.onDidChangeTextDocument((e) => later(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => { collection.delete(doc.uri); cache.delete(doc.uri.toString()); }),
    vscode.languages.registerHoverProvider('avisoq', {
      async provideHover(document, position) {
        const text = (await analyse(document))?.lastGood.hover(position.line + 1, position.character + 1);
        if (!text) return null;
        const lines = text.split('\n');
        const code = lines.filter((l) => !/^[A-Z].*\.$/.test(l)), prose = lines.filter((l) => /^[A-Z].*\.$/.test(l));
        const md = new vscode.MarkdownString();
        md.appendCodeblock(code.join('\n'), 'avisoq');
        if (prose.length) md.appendText(prose.join('\n'));
        return new vscode.Hover(md);
      },
    }),
    vscode.languages.registerDefinitionProvider('avisoq', {
      async provideDefinition(document, position) {
        const d = (await analyse(document))?.lastGood.definition(position.line + 1, position.character + 1);
        if (!d) return null;
        return new vscode.Location(d.file ? vscode.Uri.file(d.file) : document.uri, new vscode.Position(d.line - 1, d.col - 1));
      },
    }),
    vscode.languages.registerCompletionItemProvider('avisoq', {
      async provideCompletionItems(document, position) {
        const items = (await analyse(document))?.lastGood.completions(position.line + 1) ?? [];
        return items.map((c) => { const item = new vscode.CompletionItem(c.label, KIND[c.kind]); item.detail = c.detail; return item; });
      },
    }),
    vscode.languages.registerDocumentSymbolProvider('avisoq', {
      async provideDocumentSymbols(document) {
        const outline = (await analyse(document))?.lastGood.outline ?? [];
        return outline.map((o) => new vscode.DocumentSymbol(o.name, '', SYMBOL[o.kind] ?? vscode.SymbolKind.Function,
          new vscode.Range(o.line - 1, 0, Math.min(o.endLine, document.lineCount) - 1, 0), new vscode.Range(o.line - 1, o.col - 1, o.line - 1, o.col - 1)));
      },
    }),
    vscode.languages.registerDocumentFormattingEditProvider('avisoq', {
      async provideDocumentFormattingEdits(document) {
        const m = await load();
        if (!m) return [];
        try {
          const text = document.getText();
          const formatted = m.fmt.format(text);
          if (m.fmt.shape(formatted) !== m.fmt.shape(text)) return []; // never apply an edit that would change the program
          return [vscode.TextEdit.replace(new vscode.Range(document.positionAt(0), document.positionAt(text.length)), formatted)];
        } catch {
          return []; // the file does not parse yet; the diagnostics already say why
        }
      },
    }),
  );
  for (const doc of vscode.workspace.textDocuments) analyse(doc);
}

function deactivate() {}

module.exports = { activate, deactivate };
