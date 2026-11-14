// Tests for editor support: the analysis behind hover, definition and completion, and a real
// language-server session over stdio.   node tests/ide.mjs
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspect } from '../src/ide.mjs';

let passed = 0, failed = 0;
const report = (name, ok, detail) => { if (ok) passed++; else { failed++; console.log(`FAIL  ${name}\n      ${detail}`); } };
const here = dirname(fileURLToPath(import.meta.url));

const SRC = `import "std/strings"
struct Point { x: Float, y: Float }

fn scale(p: Point, k: Float) -> Point
  requires k > 0.0
{
  let wide = p.x * k
  return Point(x: wide, y: p.y * k)
}

fn main() uses io {
  var names = split("a,b", ",")
  let q = scale(Point(x: 1.0, y: 2.0), 2.0)
  print(len(names), q.x)
}
`;
{
  const info = inspect(SRC, undefined);
  report('a clean file has no diagnostics', info.ok && info.diagnostics.length === 0, JSON.stringify(info.diagnostics));
  report('hover on a local shows its type', info.hover(7, 7) === 'let wide: Float', String(info.hover(7, 7)));
  report('hover on a use of a parameter', info.hover(7, 14) === '(parameter) p: Point', String(info.hover(7, 14)));
  report('hover on a call shows the signature and contract', (info.hover(13, 11) ?? '').startsWith('fn scale(p: Point, k: Float) -> Point\n  requires k > 0.0'), String(info.hover(13, 11)));
  report('hover on a library function', (info.hover(12, 15) ?? '').startsWith('fn split(s: Str, separator: Str) -> [Str]'), String(info.hover(12, 15)));
  report('hover on a built-in', (info.hover(14, 9) ?? '').startsWith('len(x) -> Int'), String(info.hover(14, 9)));
  report('hover on a field', info.hover(14, 23) === '(field) x: Float', String(info.hover(14, 23)));
  report('hover on a var with an inferred array type', info.hover(12, 7) === 'var names: [Str]', String(info.hover(12, 7)));
  const def = info.definition(13, 11);
  report('definition of a function in this file', def && def.line === 4 && def.col === 4, JSON.stringify(def));
  const lib = info.definition(12, 15);
  report('definition of a library function points into its module', lib && /strings\.avq$/.test(lib.file ?? '') && lib.line > 1, JSON.stringify(lib));
  const use = info.definition(8, 19);
  report('definition of a local variable', use && use.line === 7 && use.col === 7, JSON.stringify(use));
  const labels = info.completions(13).map((c) => c.label);
  report('completion offers locals in scope, functions, types and built-ins',
    ['names', 'scale', 'Point', 'split', 'print', 'match'].every((l) => labels.includes(l)) && !labels.includes('q') && !labels.includes('wide'), labels.slice(0, 12).join(','));
  report('outline lists the declarations', info.outline.map((o) => `${o.kind}:${o.name}`).join(' ') === 'Struct:Point Fn:scale Fn:main', JSON.stringify(info.outline));
  const broken = inspect(SRC.replace('p.x * k', 'p.x * 2'), undefined);
  report('a type error is reported with its position and hint', broken.diagnostics.length === 1 && broken.diagnostics[0].code === 'E0201' && broken.diagnostics[0].line === 7 && !!broken.diagnostics[0].hint, JSON.stringify(broken.diagnostics));
  const refuted = inspect(SRC.replace('2.0), 2.0)', '2.0), 2.0)\n  let n = [1]\n  print(n[0], names[len(names) - 1])').replace('requires k > 0.0', 'requires k > 0.0'), undefined);
  report('analysis survives edits', refuted.ok, JSON.stringify(refuted.diagnostics));
  report('a syntax error still gives a diagnostic', inspect('fn main() {', undefined).diagnostics[0]?.code === 'E0001', '');
}

// ---- a real session with the language server ----
{
  const server = spawn(process.execPath, [join(here, '..', 'src', 'cli.mjs'), 'lsp'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const waiting = new Map();
  const notes = [];
  let buffer = Buffer.alloc(0);
  server.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const n = Number(/Content-Length: (\d+)/.exec(buffer.subarray(0, headerEnd).toString())[1]);
      if (buffer.length < headerEnd + 4 + n) return;
      const msg = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + n).toString('utf8'));
      buffer = buffer.subarray(headerEnd + 4 + n);
      if (msg.id !== undefined && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } else notes.push(msg);
    }
  });
  const write = (msg) => { const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...msg })); server.stdin.write(`Content-Length: ${body.length}\r\n\r\n`); server.stdin.write(body); };
  let nextId = 1;
  const request = (method, params) => new Promise((res) => { const id = nextId++; waiting.set(id, res); write({ id, method, params }); });
  const note = async (method) => { for (let i = 0; i < 200; i++) { const k = notes.findIndex((m) => m.method === method); if (k >= 0) return notes.splice(k, 1)[0]; await new Promise((r) => setTimeout(r, 25)); } return null; };

  const uri = pathToFileURL(join(here, 'virtual.avq')).href;
  const init = await request('initialize', { capabilities: {} });
  report('server announces its capabilities', init.result.capabilities.hoverProvider === true && init.result.capabilities.completionProvider !== undefined, JSON.stringify(init.result));
  write({ method: 'initialized', params: {} });
  write({ method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'avisoq', version: 1, text: SRC.replace('p.x * k', 'p.x * 2') } } });
  const d1 = await note('textDocument/publishDiagnostics');
  report('diagnostics arrive when a file is opened', d1?.params.diagnostics.length === 1 && d1.params.diagnostics[0].code === 'E0201' && d1.params.diagnostics[0].range.start.line === 6, JSON.stringify(d1?.params));
  write({ method: 'textDocument/didChange', params: { textDocument: { uri, version: 2 }, contentChanges: [{ text: SRC }] } });
  const d2 = await note('textDocument/publishDiagnostics');
  report('diagnostics clear when the text is fixed', d2?.params.diagnostics.length === 0, JSON.stringify(d2?.params));
  const h = await request('textDocument/hover', { textDocument: { uri }, position: { line: 12, character: 10 } });
  report('hover over the protocol', (h.result?.contents.value ?? '').includes('fn scale(p: Point, k: Float) -> Point'), JSON.stringify(h.result));
  const g = await request('textDocument/definition', { textDocument: { uri }, position: { line: 12, character: 10 } });
  report('definition over the protocol', g.result?.range.start.line === 3 && g.result.uri === uri, JSON.stringify(g.result));
  const c = await request('textDocument/completion', { textDocument: { uri }, position: { line: 12, character: 2 } });
  report('completion over the protocol', c.result.some((i) => i.label === 'names') && c.result.some((i) => i.label === 'scale'), String(c.result.length));
  const s = await request('textDocument/documentSymbol', { textDocument: { uri } });
  report('outline over the protocol', s.result.map((x) => x.name).join(',') === 'Point,scale,main', JSON.stringify(s.result.map((x) => x.name)));
  write({ method: 'textDocument/didChange', params: { textDocument: { uri, version: 3 }, contentChanges: [{ text: 'fn  main( ) uses io{print( 1 )}\n' }] } });
  await note('textDocument/publishDiagnostics');
  const f = await request('textDocument/formatting', { textDocument: { uri }, options: {} });
  report('formatting over the protocol', f.result.length === 1 && f.result[0].newText === 'fn main() uses io {\n  print(1)\n}\n', JSON.stringify(f.result));
  const bad = await request('workspace/somethingElse', {});
  report('unknown requests get an error, not silence', bad.error?.code === -32601, JSON.stringify(bad));
  await request('shutdown', null);
  write({ method: 'exit' });
  const code = await new Promise((res) => server.on('exit', res));
  report('server exits cleanly', code === 0, String(code));
}

console.log(`[ide] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
