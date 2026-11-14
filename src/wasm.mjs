// Minimal WebAssembly binary encoder.

export const I32 = 0x7f, I64 = 0x7e, F64 = 0x7c;

export function uleb(n) {
  const out = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return out;
}

export function sleb(value) {
  let v = BigInt(value);
  const out = [];
  for (;;) {
    const b = Number(v & 0x7fn);
    v >>= 7n;
    if ((v === 0n && !(b & 0x40)) || (v === -1n && (b & 0x40))) { out.push(b); break; }
    out.push(b | 0x80);
  }
  return out;
}

export function f64bytes(x) {
  return [...new Uint8Array(new Float64Array([x]).buffer)];
}

const utf8 = new TextEncoder();
const name = (s) => { const b = [...utf8.encode(s)]; return [...uleb(b.length), ...b]; };

function append(dst, src) {
  for (let i = 0; i < src.length; i++) dst.push(src[i]);
}

function section(id, body) {
  const out = [id];
  append(out, uleb(body.length));
  append(out, body);
  return out;
}

function vec(items) {
  const out = uleb(items.length);
  for (const it of items) append(out, it);
  return out;
}

export class Module {
  constructor() {
    this.types = [];
    this.typeMap = new Map();
    this.imports = [];
    this.funcs = [];
    this.exports = [];
    this.data = [];
    this.customs = [];
    this.heapStart = 8;
    this.minPages = 1;
    this.maxPages = 32768;
  }

  typeIdx(params, results) {
    const key = `${params.join(',')}>${results.join(',')}`;
    if (!this.typeMap.has(key)) {
      this.typeMap.set(key, this.types.length);
      this.types.push([0x60, ...vec(params.map((p) => [p])), ...vec(results.map((r) => [r]))]);
    }
    return this.typeMap.get(key);
  }

  addImport(mod, field, params, results) {
    if (this.funcs.length) throw new Error('imports must be added before functions');
    this.imports.push({ mod, field, type: this.typeIdx(params, results) });
    return this.imports.length - 1;
  }

  declareFunc(params, results) {
    const f = { index: this.imports.length + this.funcs.length, type: this.typeIdx(params, results), locals: [], body: [] };
    this.funcs.push(f);
    return f;
  }

  exportFunc(field, index) { this.exports.push({ field, kind: 0, index }); }

  encode() {
    const out = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
    append(out, section(1, vec(this.types)));
    append(out, section(2, vec(this.imports.map((i) => [...name(i.mod), ...name(i.field), 0x00, ...uleb(i.type)]))));
    append(out, section(3, vec(this.funcs.map((f) => uleb(f.type)))));
    append(out, section(5, vec([[0x01, ...uleb(this.minPages), ...uleb(this.maxPages)]])));
    append(out, section(6, vec([[I32, 0x01, 0x41, ...sleb(this.heapStart), 0x0b]])));
    const exps = [[...name('memory'), 0x02, 0x00], ...this.exports.map((e) => [...name(e.field), e.kind, ...uleb(e.index)])];
    append(out, section(7, vec(exps)));
    const bodies = this.funcs.map((f) => {
      const runs = [];
      for (const t of f.locals) {
        if (runs.length && runs[runs.length - 1][1] === t) runs[runs.length - 1][0]++;
        else runs.push([1, t]);
      }
      const body = vec(runs.map(([n, t]) => [...uleb(n), t]));
      append(body, f.body);
      body.push(0x0b);
      const sized = uleb(body.length);
      append(sized, body);
      return sized;
    });
    append(out, section(10, vec(bodies)));
    if (this.data.length) {
      const seg = [0x00, 0x41, ...sleb(8), 0x0b, ...uleb(this.data.length)];
      append(seg, this.data);
      append(out, section(11, vec([seg])));
    }
    for (const c of this.customs) {
      const bytes = utf8.encode(c.text);
      const body = name(c.name);
      append(body, bytes);
      append(out, section(0, body));
    }
    return new Uint8Array(out);
  }
}
