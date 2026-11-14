// Region planning: decides where memory can be handed back, at compile time.
//
// Avisoq has no globals, and existing heap objects can only be changed through element stores
// (a[i] = v) and put(m, k, v). So if a piece of code performs no store of a pointer-carrying
// value, nothing that existed before it started can point at memory it allocated. When its
// result is also plain data, everything it allocated is garbage once it finishes, and the
// allocator can simply be rewound. No garbage collector, no reference counts, no run-time cost
// beyond saving and restoring a pointer.
//
// Marks set here, read by the backends:
//   fn.regionReset   rewind when the function returns
//   loop.iterReset   rewind at the end of every iteration (for, while, sum, comprehension)
import { elemOf, isArr, isMap, mapParts, walk } from './types.mjs';

export function planRegions(program, backend) {
  const { structs, enums } = program.types;

  // Plain data: holds no pointer into the heap.
  const flat = (t) => {
    if (t === 'Int' || t === 'Float' || t === 'Bool' || t === 'Unit') return true;
    if (t === 'Str' || isArr(t) || isMap(t)) return false;
    if (backend === 'wasm') return false; // structs live on the heap in the WebAssembly backend
    const s = structs.get(t);
    if (s) return s.fields.every((f) => flat(f.ty));
    const e = enums.get(t);
    return !!e && e.variants.every((v) => v.fields.every((f) => flat(f.ty)));
  };

  const directAlloc = (n) => n.kind === 'ArrayLit' || n.kind === 'Comp' || n.kind === 'MapLit'
    || (n.kind === 'New' && backend === 'wasm')
    || (n.kind === 'Call' && !n.fn && ['array', 'str', 'substr', 'chr', 'keys', 'copy', 'read_file', 'write_file', 'http_get', 'http_post'].includes(n.name))
    || (n.kind === 'Binary' && n.op === '+' && n.ty === 'Str');

  // Where a place ultimately lives: the variable at the bottom of xs[i].field..., or null.
  const alias = new Map(); // a variable that took an array out of another place, for push(st.items, v)
  const rootSym = (e) => {
    for (;;) {
      if (e.kind === 'Index' || e.kind === 'Field') e = e.base;
      else if (e.kind === 'Call' && !e.fn && (e.name === 'get' || e.name === 'get_or')) e = e.args[0];
      else break;
    }
    if (e.kind !== 'Name' || !e.sym) return null;
    let sym = e.sym;
    for (let k = 0; k < 8 && alias.has(sym); k++) { sym = alias.get(sym); if (sym === null) return null; }
    return sym;
  };

  // The stores a single node performs that could make existing data point at new memory.
  // Each is reported as the variable stored through (null when that cannot be told).
  //  - an element store of a pointer-carrying value
  //  - put() of a pointer-carrying key or value
  //  - push(): the array may move into newly allocated memory
  //  - assigning a mut struct parameter, which is handed back to the caller
  //  - a call to a function that does any of these through one of its parameters
  const storesOf = (n, into) => {
    if (n.kind === 'Assign' && n.target.kind === 'Index' && !flat(n.target.ty)) into(rootSym(n.target));
    else if (n.kind === 'Assign' && n.target.kind === 'Name' && n.target.sym && n.target.sym.byRef) into(n.target.sym);
    else if (n.kind === 'Call' && !n.fn && n.name === 'put' && !mapParts(n.args[0].ty).every(flat)) into(rootSym(n.args[0]));
    else if (n.kind === 'Call' && !n.fn && n.name === 'push') into(rootSym(n.args[0]));
    else if (n.kind === 'Call' && n.fn) {
      if (n.fn.storesUnknown) into(null);
      (n.fn.storesParam ?? []).forEach((st, k) => { if (st && n.args[k]) into(rootSym(n.args[k])); });
    }
  };

  // Per-function facts, closed over the call graph: does it allocate, and through which of its
  // parameters can it store? Stores into its own local values do not count: they cannot make
  // anything that existed before the call point at memory the call allocated.
  const owners = [...program.fns, ...program.tests];
  for (const o of owners) {
    o.allocs = false;
    o.storesUnknown = false;
    o.storesParam = (o.params ?? []).map(() => false);
    o.callees = new Set();
    o.roots = [...o.body, ...(o.requires ?? []).map((c) => c.expr), ...(o.ensures ?? []).map((c) => c.expr)];
    for (const r of o.roots) {
      walk(r, (n) => {
        if (directAlloc(n)) o.allocs = true;
        if (n.kind === 'Call' && n.fn) o.callees.add(n.fn);
        if (n.kind === 'Let' && n.sym && n.init && n.init.carried) alias.set(n.sym, rootSym(n.init));
      });
    }
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const o of owners) {
      for (const c of o.callees) if (c.allocs && !o.allocs) { o.allocs = true; changed = true; }
      const syms = o.paramSyms ?? [];
      for (const r of o.roots) {
        walk(r, (n) => storesOf(n, (sym) => {
          if (sym === null) { if (!o.storesUnknown) { o.storesUnknown = true; changed = true; } return; }
          const k = syms.indexOf(sym);
          if (k >= 0 && !o.storesParam[k]) { o.storesParam[k] = true; changed = true; }
        }));
      }
    }
  }
  const escapes = (f) => f.storesUnknown || f.storesParam.some(Boolean);

  for (const f of program.fns) {
    f.regionReset = f !== program.main && f.allocs && !escapes(f) && flat(f.ret);
  }

  // A piece of code inside a function: does it allocate, and does it store through anything
  // that was not declared inside it?
  const facts = (nodes) => {
    let allocs = false, outside = false;
    const declared = new Set();
    for (const r of nodes) walk(r, (x) => { if ((x.kind === 'Let' || x.kind === 'For' || x.kind === 'Sum' || x.kind === 'Comp') && x.sym) declared.add(x.sym); });
    for (const r of nodes) {
      walk(r, (n) => {
        if (directAlloc(n) || (n.kind === 'Call' && n.fn && n.fn.allocs)) allocs = true;
        storesOf(n, (sym) => { if (sym === null || !declared.has(sym)) outside = true; });
        // giving a value that holds pointers to a variable from outside keeps it alive
        if (n.kind === 'Assign' && n.target.kind === 'Name' && n.target.sym && !flat(n.target.sym.ty) && !declared.has(n.target.sym)) outside = true;
      });
    }
    return { allocs, outside };
  };

  for (const o of owners) {
    for (const top of o.body) {
      walk(top, (n) => {
        if (n.kind === 'For' || n.kind === 'While') {
          const { allocs, outside } = facts(n.body);
          n.iterReset = allocs && !outside;
        } else if (n.kind === 'Sum' || n.kind === 'Comp') {
          const { allocs, outside } = facts([n.body]);
          n.iterReset = allocs && !outside && (n.kind === 'Sum' || (n.ty !== '?' && flat(elemOf(n.ty))));
        }
      });
    }
  }
}
