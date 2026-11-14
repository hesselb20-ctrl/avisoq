// Avisoq language server (Language Server Protocol over stdio). Start it with: avisoq lsp
// Works with any editor that speaks LSP: diagnostics while typing, hover, go to definition,
// completion, document outline and formatting.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { format, shape } from './format.mjs';
import { inspect } from './ide.mjs';

const KIND = { variable: 6, function: 3, struct: 22, enum: 13, variant: 20, keyword: 14, type: 7 };
const SYMBOL = { Fn: 12, Struct: 23, Enum: 10, Test: 12 };

export function startServer(input = process.stdin, output = process.stdout) {
  const docs = new Map(); // uri -> { text, info, lastGood }
  const send = (msg) => {
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...msg }), 'utf8');
    output.write(`Content-Length: ${body.length}\r\n\r\n`);
    output.write(body);
  };
  const pathOf = (uri) => { try { return fileURLToPath(uri); } catch { return undefined; } };

  function refresh(uri, text) {
    const path = pathOf(uri);
    let info;
    try { info = inspect(text, path); } catch (e) {
      info = { ok: false, diagnostics: [{ code: 'E9999', message: `internal error in the analyser: ${e.message}`, line: 1, col: 1 }], hover: () => null, definition: () => null, completions: () => [], outline: [] };
    }
    const prev = docs.get(uri);
    docs.set(uri, { text, info, lastGood: info.ok ? info : prev?.lastGood ?? info });
    const lines = text.split('\n');
    send({
      method: 'textDocument/publishDiagnostics',
      params: {
        uri,
        diagnostics: info.diagnostics.map((d) => {
          // A problem located in an imported file is reported at the top of this one.
          const elsewhere = d.file && path && resolve(d.file) !== resolve(path);
          const line = elsewhere ? 0 : Math.max(0, d.line - 1), col = elsewhere ? 0 : Math.max(0, d.col - 1);
          return {
            range: { start: { line, character: col }, end: { line, character: Math.max(col + 1, (lines[line] ?? '').length) } },
            severity: 1,
            code: d.code,
            source: 'avisoq',
            message: `${d.message}${d.hint ? `\nhint: ${d.hint}` : ''}${elsewhere ? `\n(in ${d.file}:${d.line})` : ''}`,
          };
        }),
      },
    });
  }

  function handle(msg) {
    const { id, method, params } = msg;
    const reply = (result) => { if (id !== undefined) send({ id, result }); };
    const doc = params?.textDocument ? docs.get(params.textDocument.uri) : null;
    const pos = params?.position ? [params.position.line + 1, params.position.character + 1] : null;
    switch (method) {
      case 'initialize':
        reply({
          capabilities: {
            textDocumentSync: 1,
            hoverProvider: true,
            definitionProvider: true,
            documentSymbolProvider: true,
            documentFormattingProvider: true,
            completionProvider: {},
          },
          serverInfo: { name: 'avisoq', version: '0.5.0' },
        });
        break;
      case 'textDocument/didOpen': refresh(params.textDocument.uri, params.textDocument.text); break;
      case 'textDocument/didChange': refresh(params.textDocument.uri, params.contentChanges[params.contentChanges.length - 1].text); break;
      case 'textDocument/didClose':
        docs.delete(params.textDocument.uri);
        send({ method: 'textDocument/publishDiagnostics', params: { uri: params.textDocument.uri, diagnostics: [] } });
        break;
      case 'textDocument/hover': {
        const text = doc?.lastGood.hover(...pos);
        reply(text ? { contents: { kind: 'markdown', value: `\`\`\`avisoq\n${text.split('\n').filter((l) => !/^[A-Z].*\.$/.test(l)).join('\n')}\n\`\`\`${text.split('\n').filter((l) => /^[A-Z].*\.$/.test(l)).map((l) => `\n${l}`).join('')}` } } : null);
        break;
      }
      case 'textDocument/definition': {
        const d = doc?.lastGood.definition(...pos);
        const uri = d?.file ? pathToFileURL(d.file).href : params.textDocument.uri;
        reply(d ? { uri, range: { start: { line: d.line - 1, character: d.col - 1 }, end: { line: d.line - 1, character: d.col - 1 } } } : null);
        break;
      }
      case 'textDocument/completion':
        reply((doc?.lastGood.completions(pos[0]) ?? []).map((c) => ({ label: c.label, kind: KIND[c.kind] ?? 1, detail: c.detail })));
        break;
      case 'textDocument/documentSymbol':
        reply((doc?.lastGood.outline ?? []).map((o) => {
          const range = { start: { line: o.line - 1, character: 0 }, end: { line: o.endLine - 1, character: 0 } };
          return { name: o.name, kind: SYMBOL[o.kind] ?? 12, range, selectionRange: { start: { line: o.line - 1, character: o.col - 1 }, end: { line: o.line - 1, character: o.col - 1 } } };
        }));
        break;
      case 'textDocument/formatting': {
        let edits = [];
        try {
          const text = doc.text, out = format(text);
          // Never return an edit that would change what the program means.
          if (out !== text && shape(out) === shape(text)) {
            const lines = text.split('\n');
            edits = [{ range: { start: { line: 0, character: 0 }, end: { line: lines.length, character: 0 } }, newText: out }];
          }
        } catch { /* the file does not parse; the diagnostics already say why */ }
        reply(edits);
        break;
      }
      case 'shutdown': reply(null); break;
      case 'exit': process.exit(0); break;
      default:
        if (id !== undefined) send({ id, error: { code: -32601, message: `method not supported: ${method}` } });
    }
  }

  // Message framing: "Content-Length: N\r\n\r\n" followed by N bytes of JSON.
  let buffer = Buffer.alloc(0);
  input.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const m = /Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString('ascii'));
      if (!m) { buffer = buffer.subarray(headerEnd + 4); continue; }
      const total = headerEnd + 4 + Number(m[1]);
      if (buffer.length < total) return;
      const body = buffer.subarray(headerEnd + 4, total).toString('utf8');
      buffer = buffer.subarray(total);
      try { handle(JSON.parse(body)); } catch (e) { process.stderr.write(`avisoq lsp: ${e.stack}\n`); }
    }
  });
}
