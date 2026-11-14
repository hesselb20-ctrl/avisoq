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

  const pointerStore = (n) => (n.kind === 'Assign' && n.target.kind === 'Index' && !flat(n.target.ty))
    || (n.kind === 'Call' && !n.fn && n.name === 'put' && !mapParts(n.args[0].ty).every(flat))
    // a mut struct parameter is handed back to the caller, so what it holds must outlive this code
    || (n.kind === 'Assign' && n.target.kind === 'Name' && !!n.target.sym && !!n.target.sym.byRef)
    // push may move an array into newly allocated memory that has to outlive this code
    || (n.kind === 'Call' && !n.fn && n.name === 'push');

  // Per-function facts, closed over the call graph.
  const owners = [...program.fns, ...program.tests];
  for (const o of owners) {
    o.allocs = false;
    o.stores = false;
    o.callees = new Set();
    const roots = [...o.body, ...(o.requires ?? []).map((c) => c.expr), ...(o.ensures ?? []).map((c) => c.expr)];
    for (const r of roots) {
      walk(r, (n) => {
        if (directAlloc(n)) o.allocs = true;
        if (pointerStore(n)) o.stores = true;
        if (n.kind === 'Call' && n.fn) o.callees.add(n.fn);
      });
    }
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const o of owners) {
      for (const c of o.callees) {
        if (c.allocs && !o.allocs) { o.allocs = true; changed = true; }
        if (c.stores && !o.stores) { o.stores = true; changed = true; }
      }
    }
  }

  const facts = (nodes) => {
    let allocs = false, stores = false;
    for (const r of nodes) {
      walk(r, (n) => {
        if (directAlloc(n) || (n.kind === 'Call' && n.fn && n.fn.allocs)) allocs = true;
        if (pointerStore(n) || (n.kind === 'Call' && n.fn && n.fn.stores)) stores = true;
      });
    }
    return { allocs, stores };
  };

  for (const f of program.fns) {
    f.regionReset = f !== program.main && f.allocs && !f.stores && flat(f.ret);
  }

  for (const o of owners) {
    for (const top of o.body) {
      walk(top, (n) => {
        if (n.kind === 'For' || n.kind === 'While') {
          const { allocs, stores } = facts(n.body);
          const declared = new Set();
          let rebindsOuter = false;
          for (const b of n.body) {
            walk(b, (x) => {
              if (x.kind === 'Let' || x.kind === 'For' || x.kind === 'Sum' || x.kind === 'Comp') declared.add(x.sym);
            });
          }
          for (const b of n.body) {
            walk(b, (x) => {
              if (x.kind === 'Assign' && x.target.kind === 'Name' && !flat(x.target.sym.ty) && !declared.has(x.target.sym)) rebindsOuter = true;
            });
          }
          n.iterReset = allocs && !stores && !rebindsOuter;
        } else if (n.kind === 'Sum' || n.kind === 'Comp') {
          const { allocs, stores } = facts([n.body]);
          n.iterReset = allocs && !stores && (n.kind === 'Sum' || (n.ty !== '?' && flat(elemOf(n.ty))));
        }
      });
    }
  }
}
