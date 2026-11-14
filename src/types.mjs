// Type helpers. Types are canonical strings: Int, Float, Bool, Str, Unit, [T], Map[K,V], StructName.

export const isArr = (t) => t[0] === '[';
export const elemOf = (t) => t.slice(1, -1);
export const isMap = (t) => t.startsWith('Map[');

// 'Map[K,V]' -> [K, V]
export function mapParts(t) {
  let depth = 0;
  for (let i = 4; i < t.length - 1; i++) {
    if (t[i] === '[') depth++;
    else if (t[i] === ']') depth--;
    else if (t[i] === ',' && depth === 0) return [t.slice(4, i), t.slice(i + 1, -1)];
  }
  throw new Error(`bad map type ${t}`);
}

// Direct sub-nodes of an AST node (expressions and statements).
export function children(n) {
  switch (n.kind) {
    case 'Unary': return [n.operand];
    case 'Binary': return [n.left, n.right];
    case 'Index': return [n.base, n.index];
    case 'Field': return [n.base];
    case 'New': return n.fields.map((f) => f.expr);
    case 'ArrayLit': case 'Tuple': return n.elems;
    case 'LetTuple': return [n.init];
    case 'Cond': return [n.cond, n.then, n.els];
    case 'ForIn': return [n.iter, ...n.body];
    case 'Sum': case 'Comp': return [n.start, n.end, n.body];
    case 'Call': return n.args;
    case 'Lambda': return [n.body];
    case 'Let': return [n.init];
    case 'Assign': return [n.target, n.value];
    case 'If': return [n.cond, ...n.then, ...(n.els ?? [])];
    case 'While': return [n.cond, ...(n.invariants ?? []).map((c) => c.expr), ...n.body];
    case 'For': return [n.start, n.end, ...n.body];
    case 'Return': return n.value ? [n.value] : [];
    case 'Match': return [n.scrut, ...n.arms.flatMap((arm) => arm.body)];
    case 'Assert': return [n.cond];
    case 'ExprStmt': return [n.expr];
    default: return [];
  }
}

export function walk(n, f) {
  f(n);
  for (const c of children(n)) walk(c, f);
}

// ---- generic type helpers ----
// 'Name[A,B]' -> ['A', 'B'];  'Name' and '[T]' -> []
export function typeArgs(t) {
  const i = t.indexOf('[');
  if (i <= 0) return [];
  const out = [];
  let depth = 0, start = i + 1;
  for (let k = i + 1; k < t.length - 1; k++) {
    if (t[k] === '[') depth++;
    else if (t[k] === ']') depth--;
    else if (t[k] === ',' && depth === 0) { out.push(t.slice(start, k)); start = k + 1; }
  }
  out.push(t.slice(start, -1));
  return out;
}
export const typeHead = (t) => { const i = t.indexOf('['); return i <= 0 ? t : t.slice(0, i); };
// Replaces type parameter names by the types bound to them.
export const substType = (t, map) => t.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (w) => map.get(w) ?? w);
// Matches a type pattern containing parameters against a concrete type, extending the bindings.
export function unify(pat, act, params, bound) {
  if (params.has(pat)) {
    if (!bound.has(pat)) { bound.set(pat, act); return true; }
    return bound.get(pat) === act;
  }
  if (isArr(pat)) return isArr(act) && unify(elemOf(pat), elemOf(act), params, bound);
  const pa = typeArgs(pat);
  if (!pa.length) return pat === act;
  if (isArr(act) || typeHead(pat) !== typeHead(act)) return false;
  const aa = typeArgs(act);
  return pa.length === aa.length && pa.every((x, i) => unify(x, aa[i], params, bound));
}
// A type or instance name as a C identifier fragment.
export const mangle = (t) => t.replace(/\[/g, '_L').replace(/\]/g, '_R').replace(/,/g, '_').replace(/</g, '_F').replace(/>/g, '_E').replace(/#/g, '_n').replace(/[^A-Za-z0-9_]/g, '_');

// A type as it is written in source: [T], Map[K, V], fn(A, B) -> R.
export function showType(t) {
  if (isArr(t)) return `[${showType(elemOf(t))}]`;
  const args = typeArgs(t);
  if (!args.length) return t;
  if (/^Tuple[2-4]$/.test(typeHead(t))) return `(${args.map(showType).join(', ')})`;
  if (typeHead(t) === 'Fn') return `fn(${args.slice(1).map(showType).join(', ')})${args[0] === 'Unit' ? '' : ` -> ${showType(args[0])}`}`;
  return `${typeHead(t)}[${args.map(showType).join(', ')}]`;
}

// Does a value of this type hold an array or a map anywhere inside it?
export function containerTest(types) {
  const memo = new Map();
  const has = (t) => {
    if (isArr(t) || isMap(t)) return true;
    if (memo.has(t)) return memo.get(t);
    memo.set(t, false);
    const s = types.structs.get(t), e = types.enums.get(t);
    const r = s ? s.fields.some((f) => has(f.ty)) : e ? e.variants.some((v) => v.fields.some((f) => has(f.ty))) : false;
    memo.set(t, r);
    return r;
  };
  return has;
}
