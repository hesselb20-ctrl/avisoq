// Editor support shared by the language server and the VS Code extension: diagnostics,
// hover, go to definition, completion and document outline, all from one analysis of the text.
import { analyze } from './compiler.mjs';
import { KEYWORDS } from './lexer.mjs';
import { showType, walk } from './types.mjs';

export const BUILTIN_DOCS = {
  print: 'print(values...) uses io\nWrites the values on one line, separated by spaces.',
  len: 'len(x) -> Int\nNumber of elements of an array, entries of a map, or bytes of a Str.',
  array: 'array(n: Int, init: T) -> [T]\nAn array of n copies of init.',
  copy: 'copy(x: T) -> T\nAn independent deep copy. Needed when an array or map would otherwise be shared.',
  push: 'push(xs: mut [T], value: T)\nAdds value at the end. xs must be a var or a mut parameter.',
  pop: 'pop(xs: mut [T]) -> T\nRemoves and returns the last element. Fails if the array is empty.',
  float: 'float(i: Int) -> Float',
  int: 'int(f: Float) -> Int\nTruncates toward zero. Fails if the value does not fit.',
  sqrt: 'sqrt(f: Float) -> Float',
  str: 'str(x) -> Str\nText for an Int, Float or Bool.',
  substr: 'substr(s: Str, start: Int, end: Int) -> Str\nBytes start up to (not including) end.',
  byte_at: 'byte_at(s: Str, i: Int) -> Int\nThe byte at position i (0 to 255).',
  chr: 'chr(byte: Int) -> Str\nA one-byte string, the reverse of byte_at. Fails outside 0 to 255.',
  now_ms: 'now_ms() -> Float uses time',
  put: 'put(m: mut Map[K, V], key: K, value: V)',
  get: 'get(m: Map[K, V], key: K) -> V\nFails if the key is missing; see get_or and has.',
  get_or: 'get_or(m: Map[K, V], key: K, default: V) -> V',
  has: 'has(m: Map[K, V], key: K) -> Bool',
  remove: 'remove(m: mut Map[K, V], key: K) -> Bool\nTrue if the key was present.',
  keys: 'keys(m: Map[K, V]) -> [K]\nIn insertion order.',
  sum: 'sum(i in start..end: expression)\nAdds the expression for every i. Runs on every core; the body must be pure.',
  read_file: 'read_file(path: Str) -> Result[Str, Str] uses fs',
  write_file: 'write_file(path: Str, content: Str) -> Result[Int, Str] uses fs\nOk holds the number of bytes written.',
  file_exists: 'file_exists(path: Str) -> Bool uses fs',
  http_get: 'http_get(url: Str) -> Result[Str, Str] uses net',
  http_post: 'http_post(url: Str, body: Str, content_type: Str) -> Result[Str, Str] uses net',
};

function signature(d) {
  if (d.kind === 'Struct') return `struct ${d.name}${typeParams(d)} { ${d.fields.map((f) => `${f.name}: ${showType(f.ty)}`).join(', ')} }`;
  if (d.kind === 'Enum') return `enum ${d.name}${typeParams(d)} { ${d.variants.map((v) => `${v.name}${v.fields.length ? `(${v.fields.map((f) => `${f.name}: ${showType(f.ty)}`).join(', ')})` : ''}`).join(', ')} }`;
  let s = `fn ${d.name}${typeParams(d)}(${d.params.map((p) => `${p.name}: ${p.mut ? 'mut ' : ''}${showType(p.ty)}`).join(', ')})`;
  if (d.ret !== 'Unit') s += ` -> ${showType(d.ret)}`;
  if (d.effects.length) s += ` uses ${d.effects.map((e) => e.name).join(', ')}`;
  for (const c of d.requires) s += `\n  requires ${c.text}`;
  for (const c of d.ensures) s += `\n  ensures ${c.text}`;
  return s;
}
const typeParams = (d) => (d.typeParams?.length ? `[${d.typeParams.map((p) => (d.typeBounds?.[p] ? `${p}: ${d.typeBounds[p]}` : p)).join(', ')}]` : '');

// Analyses one document. `path` is its file path (used to resolve imports), or undefined.
export function inspect(src, path) {
  const { program, diagnostics, decls } = analyze(src, { path });
  const entries = new Map(); // 'line:col' -> { line, col, len, hover, def }
  const put = (line, col, len, hover, def) => {
    const k = `${line}:${col}`;
    if (!entries.has(k) && line && col) entries.set(k, { line, col, len, hover, def: def ?? null });
  };
  const byName = new Map();
  const variantOf = new Map();
  for (const d of decls ?? []) {
    byName.set(d.name, d);
    if (d.kind === 'Enum') for (const v of d.variants) variantOf.set(v.name, d);
  }
  // Is this node in the document itself (and not in a module it imports)?
  const here = (n) => (n.file ?? undefined) === path;
  const at = (d) => ({ file: d.file ?? path, line: d.line, col: d.col });
  const symHover = (sym) => `${sym.isParam ? '(parameter) ' : sym.mutable ? 'var ' : 'let '}${sym.name}: ${showType(sym.ty)}`;

  if (program) {
    for (const d of decls) if (here(d) && d.kind !== 'Import' && d.kind !== 'Test') put(d.line, d.col, d.name.length, signature(d), at(d));
    for (const owner of [...program.fns, ...program.tests]) {
      if (!here(owner) || owner.isLambda) continue;
      (owner.paramSyms ?? []).forEach((sym) => { if (sym.decl && !sym.name.startsWith('__cap')) put(sym.decl.line, sym.decl.col, sym.name.length, symHover(sym), sym.decl); });
      const roots = [...owner.body, ...(owner.requires ?? []).map((c) => c.expr), ...(owner.ensures ?? []).map((c) => c.expr)];
      for (const r of roots) {
        walk(r, (n) => {
          if (!here(n)) return;
          if ((n.kind === 'Let' || n.kind === 'For') && n.sym) put(n.line, n.col, n.name.length, symHover(n.sym), n.sym.decl);
          else if (n.kind === 'Name' && n.sym && !n.sym.isResult) put(n.line, n.col, n.name.length, symHover(n.sym), n.sym.decl);
          else if (n.kind === 'Call') {
            const d = n.fn ? byName.get(n.fn.generic ?? n.fn.name) : null;
            if (d) put(n.line, n.col, n.name.length, signature(d), at(d));
            else if (BUILTIN_DOCS[n.name]) put(n.line, n.col, n.name.length, BUILTIN_DOCS[n.name]);
          } else if (n.kind === 'Sum') put(n.line, n.col, 3, BUILTIN_DOCS.sum);
          else if (n.kind === 'New') {
            const d = byName.get(n.name) ?? variantOf.get(n.name);
            if (d) put(n.line, n.col, n.name.length, signature(d), at(d));
          } else if (n.kind === 'Field' && n.ty) put(n.line, n.col, n.name.length, `(field) ${n.name}: ${showType(n.ty)}`);
          else if (n.kind === 'Match') {
            for (const arm of n.arms) (arm.syms ?? []).forEach((sym) => { if (sym?.decl) put(sym.decl.line, sym.decl.col, sym.name.length, symHover(sym), sym.decl); });
          }
        });
      }
    }
  }

  const find = (line, col) => {
    for (const e of entries.values()) if (e.line === line && col >= e.col && col <= e.col + e.len) return e;
    return null;
  };

  function completions(line) {
    const items = [];
    const seen = new Set();
    const add = (label, kind, detail) => { if (!seen.has(label)) { seen.add(label); items.push({ label, kind, detail }); } };
    if (program) {
      const owner = [...program.fns, ...program.tests].find((o) => here(o) && !o.isLambda && o.line <= line && line <= (o.endLine ?? o.line));
      if (owner) {
        for (const sym of [...(owner.paramSyms ?? []), ...(owner.locals ?? [])]) {
          if (sym.name && sym.name !== '<tmp>' && !sym.name.startsWith('__cap') && !sym.isResult && (!sym.decl || sym.isParam || sym.decl.line < line)) add(sym.name, 'variable', showType(sym.ty));
        }
      }
      for (const d of decls) {
        if (d.kind === 'Fn') add(d.name, 'function', signature(d).split('\n')[0]);
        else if (d.kind === 'Struct') add(d.name, 'struct', signature(d));
        else if (d.kind === 'Enum') { add(d.name, 'enum', signature(d)); for (const v of d.variants) add(v.name, 'variant', `variant of ${d.name}`); }
      }
    }
    for (const [name, doc] of Object.entries(BUILTIN_DOCS)) add(name, 'function', doc.split('\n')[0]);
    for (const k of KEYWORDS) add(k, 'keyword', '');
    for (const t of ['Int', 'Float', 'Bool', 'Str', 'Map']) add(t, 'type', 'built-in type');
    return items;
  }

  const outline = (decls ?? []).filter((d) => here(d) && d.kind !== 'Import')
    .map((d) => ({ name: d.kind === 'Test' ? `test "${d.name}"` : d.name, kind: d.kind, line: d.line, col: d.col, endLine: d.endLine ?? d.line }));

  return {
    ok: !!program,
    diagnostics,
    hover: (line, col) => find(line, col)?.hover ?? null,
    definition: (line, col) => find(line, col)?.def ?? null,
    completions,
    outline,
  };
}
