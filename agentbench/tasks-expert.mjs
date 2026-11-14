// Expert tasks for the agent benchmark: each is a real program (an interpreter, a strict parser,
// a regular-expression matcher, a spreadsheet with cycle detection, exact fractions, long
// division) with a detailed statement and many hidden tests, part hand-written and part
// generated from the reference with a fixed seed. Meant to be hard enough that some runs fail.
// Same shape as tasks.mjs. Types: Int, Bool, Str, [Int]. Strings are plain ASCII without " or \.

const B = BigInt;
const rng = (seed) => { let a = seed >>> 0; return () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296); };
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// ---------------------------------------------------------------- interp
function interp(src) {
  const toks = src.match(/\d+|[a-z]+|==|!=|<=|>=|[-+*\/%<>=(){};]/g) ?? [];
  let p = 0;
  const eat = () => toks[p++];
  const atom = () => {
    const t = eat();
    if (t === '(') { const e = expr(); eat(); return e; }
    if (/^\d/.test(t)) return { k: 'n', v: B(t) };
    return { k: 'v', name: t };
  };
  const unary = () => { if (toks[p] === '-') { eat(); return { k: 'neg', a: unary() }; } return atom(); };
  const bin = (next, ops) => () => { let l = next(); while (ops.includes(toks[p])) { const op = eat(); l = { k: 'b', op, l, r: next() }; } return l; };
  const prod = bin(unary, ['*', '/', '%']);
  const sum = bin(prod, ['+', '-']);
  const expr = () => { const l = sum(); if (['<', '<=', '>', '>=', '==', '!='].includes(toks[p])) { const op = eat(); return { k: 'b', op, l, r: sum() }; } return l; };
  const block = () => { eat(); const b = []; while (toks[p] !== '}') b.push(stmt()); eat(); return b; };
  const stmt = () => {
    const t = eat();
    if (t === 'print') { const e = expr(); eat(); return { k: 'print', e }; }
    if (t === 'while') { const c = expr(); return { k: 'while', c, body: block() }; }
    if (t === 'if') { const c = expr(); const then = block(); let els = []; if (toks[p] === 'else') { eat(); els = block(); } return { k: 'if', c, then, els }; }
    eat(); const e = expr(); eat(); return { k: 'set', name: t, e };
  };
  const prog = []; while (p < toks.length) prog.push(stmt());
  const vars = new Map(), out = []; let steps = 0;
  const step = () => { if (++steps > 5000) throw new Error('!steps'); };
  const ev = (e) => {
    if (e.k === 'n') return e.v;
    if (e.k === 'v') { if (!vars.has(e.name)) throw new Error('!undef'); return vars.get(e.name); }
    if (e.k === 'neg') return -ev(e.a);
    const l = ev(e.l), r = ev(e.r);
    switch (e.op) {
      case '+': return l + r; case '-': return l - r; case '*': return l * r;
      case '/': if (r === 0n) throw new Error('!div0'); return l / r;
      case '%': if (r === 0n) throw new Error('!div0'); return l % r;
      case '<': return l < r ? 1n : 0n; case '<=': return l <= r ? 1n : 0n; case '>': return l > r ? 1n : 0n;
      case '>=': return l >= r ? 1n : 0n; case '==': return l === r ? 1n : 0n; default: return l !== r ? 1n : 0n;
    }
  };
  const run = (b) => {
    for (const s of b) {
      if (s.k === 'while') { for (;;) { step(); if (ev(s.c) === 0n) break; run(s.body); } continue; }
      step();
      if (s.k === 'print') out.push(String(ev(s.e)));
      else if (s.k === 'set') vars.set(s.name, ev(s.e));
      else run(ev(s.c) !== 0n ? s.then : s.els);
    }
  };
  try { run(prog); } catch (e) { out.push(e.message); }
  return out.join(',');
}

// ---------------------------------------------------------------- json_canon
function jsonCanon(s) {
  let i = 0;
  const bad = () => { throw new Error('bad'); };
  const ws = () => { while (s[i] === ' ') i++; };
  const str = () => { i++; const j = s.indexOf("'", i); if (j < 0) bad(); const v = s.slice(i, j); i = j + 1; return v; };
  const value = () => {
    ws();
    const c = s[i];
    if (c === '{') {
      i++; const m = new Map(); ws();
      if (s[i] === '}') { i++; return { o: m }; }
      for (;;) {
        ws(); if (s[i] !== "'") bad();
        const k = str(); ws(); if (s[i] !== ':') bad(); i++;
        m.set(k, value()); ws();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === '}') { i++; return { o: m }; }
        bad();
      }
    }
    if (c === '[') {
      i++; const a = []; ws();
      if (s[i] === ']') { i++; return { a }; }
      for (;;) {
        a.push(value()); ws();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ']') { i++; return { a }; }
        bad();
      }
    }
    if (c === "'") return { s: str() };
    for (const w of ['true', 'false', 'null']) if (s.startsWith(w, i)) { i += w.length; return { w }; }
    const m = /^-?(0|[1-9][0-9]*)/.exec(s.slice(i));
    if (!m) bad();
    i += m[0].length;
    return { n: B(m[0]) };
  };
  const show = (v) => {
    if (v.o) return `{${[...v.o.keys()].sort().map((k) => `'${k}':${show(v.o.get(k))}`).join(',')}}`;
    if (v.a) return `[${v.a.map(show).join(',')}]`;
    if (v.s !== undefined) return `'${v.s}'`;
    if (v.w) return v.w;
    return String(v.n);
  };
  try { const v = value(); ws(); if (i !== s.length) bad(); return show(v); } catch { return 'error'; }
}

// ---------------------------------------------------------------- regex_match
const regexMatch = (p, t) => new RegExp(`^(?:${p})$`).test(t);
function regexTests() {
  const r = rng(20261114), tests = [];
  const gen = (depth) => {
    const atom = () => {
      const x = r();
      if (depth > 0 && x < 0.22) { const a = alt(depth - 1); return { p: `(${a.p})`, s: a.s }; }
      if (x < 0.32) return { p: '.', s: () => pick(r, ['a', 'b', 'c']) };
      const ch = pick(r, ['a', 'b', 'c']); return { p: ch, s: () => ch };
    };
    const piece = () => {
      const a = atom(), x = r();
      if (x < 0.6) return a;
      if (x < 0.75) return { p: `${a.p}*`, s: () => Array.from({ length: int(r, 0, 3) }, a.s).join('') };
      if (x < 0.9) return { p: `${a.p}+`, s: () => Array.from({ length: int(r, 1, 3) }, a.s).join('') };
      return { p: `${a.p}?`, s: () => (r() < 0.5 ? a.s() : '') };
    };
    const seq = () => { const ps = Array.from({ length: r() < 0.06 ? 0 : int(r, 1, 3) }, piece); return { p: ps.map((x) => x.p).join(''), s: () => ps.map((x) => x.s()).join('') }; };
    const alt = (d) => { depth = d; const ss = Array.from({ length: r() < 0.3 ? 2 : 1 }, seq); depth = d; return { p: ss.map((x) => x.p).join('|'), s: () => pick(r, ss).s() }; };
    return alt(depth);
  };
  while (tests.length < 36) {
    const g = gen(2);
    if (g.p.length > 24) continue;
    const s = g.s();
    if (s.length > 30) continue;
    tests.push([g.p, s]);
    const m = s.length && r() < 0.5 ? s.slice(0, int(r, 0, s.length - 1)) + pick(r, ['a', 'b', 'c', '']) + s.slice(int(r, 0, s.length)) : s + pick(r, ['a', 'b', 'c']);
    tests.push([g.p, m]);
  }
  return [['', ''], ['', 'a'], ['a', ''], ['a*', ''], ['a|', ''], ['(|a)b', 'b'], ['.', 'ab'], ['.*', 'abcabc'], ['a.c', 'abc'], ['(ab)+', 'ababab'], ['(ab)+', 'aba'],
    ['(a|b)*c', 'ababbac'], ['(a|ab)(c|bcd)(d*)', 'abcd'], ['a?a?a?aaa', 'aaa'], ['(a*)*b', 'aaaaaaaaaaaaaaaaaaaaab'], ['(a*)*b', 'aaaaaaaaaaaaaaaaaaaaac'], ['(a|aa)+', 'aaaaaaaaaaaaaaaaaaaaaaaaab'],
    ['x(y|z)*x', 'xyzzyx'], ['x(y|z)*x', 'xyzwx'], ['()*a', 'a'], ['(a(b(c)?)?)?d', 'abd'], ['(a(b(c)?)?)?d', 'acd'], ...tests];
}

// ---------------------------------------------------------------- sheet
function sheet(cells) {
  const formulas = new Map();
  for (const part of cells === '' ? [] : cells.split(';')) { const eq = part.indexOf('='); formulas.set(part.slice(0, eq), part.slice(eq + 1)); }
  const parse = (f) => {
    const toks = f.match(/\d+|[A-Z][1-9]|[-+*()]/g); let p = 0;
    const atom = () => { const t = toks[p++]; if (t === '(') { const e = sum(); p++; return e; } if (t === '-') return { k: 'neg', a: atom() }; return /^\d/.test(t) ? { k: 'n', v: B(t) } : { k: 'c', name: t }; };
    const prod = () => { let l = atom(); while (toks[p] === '*') { p++; l = { k: '*', l, r: atom() }; } return l; };
    const sum = () => { let l = prod(); while (toks[p] === '+' || toks[p] === '-') { const k = toks[p++]; l = { k, l, r: prod() }; } return l; };
    return sum();
  };
  const ast = new Map([...formulas].map(([k, f]) => [k, parse(f)]));
  const deps = (e, acc = new Set()) => { if (e.k === 'c') acc.add(e.name); for (const c of [e.a, e.l, e.r]) if (c) deps(c, acc); return acc; };
  const edges = new Map([...ast].map(([k, e]) => [k, [...deps(e)].filter((d) => ast.has(d))]));
  const reach = (from) => { const seen = new Set(), todo = [...edges.get(from)]; while (todo.length) { const x = todo.pop(); if (!seen.has(x)) { seen.add(x); todo.push(...edges.get(x)); } } return seen; };
  const onCycle = new Set([...ast.keys()].filter((k) => reach(k).has(k)));
  const bad = new Set([...ast.keys()].filter((k) => onCycle.has(k) || [...reach(k)].some((d) => onCycle.has(d))));
  const memo = new Map();
  const cell = (name) => { if (!ast.has(name)) return 0n; if (!memo.has(name)) memo.set(name, ev(ast.get(name))); return memo.get(name); };
  const ev = (e) => (e.k === 'n' ? e.v : e.k === 'c' ? cell(e.name) : e.k === 'neg' ? -ev(e.a) : e.k === '+' ? ev(e.l) + ev(e.r) : e.k === '-' ? ev(e.l) - ev(e.r) : ev(e.l) * ev(e.r));
  return [...ast.keys()].sort().map((k) => `${k}=${bad.has(k) ? '#CYCLE' : cell(k)}`).join(',');
}

// ---------------------------------------------------------------- toposort
function toposort(n, edges) {
  const need = Array(n).fill(0), out = [], done = Array(n).fill(false);
  const pairs = []; for (let i = 0; i < edges.length; i += 2) { pairs.push([edges[i], edges[i + 1]]); need[edges[i + 1]]++; }
  for (let k = 0; k < n; k++) {
    const u = need.findIndex((c, i) => c === 0 && !done[i]);
    if (u < 0) return [-1];
    done[u] = true; out.push(u);
    for (const [a, b] of pairs) if (a === u) need[b]--;
  }
  return out;
}

// ---------------------------------------------------------------- frac_calc
function fracCalc(s, limit) {
  const toks = s.match(/\d+|[-+*\/()]/g) ?? []; let p = 0;
  const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
  const norm = (n, d) => { if (d === 0n) throw new Error('div0'); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; const v = [n / g, d / g]; if (limit && (v[0] > limit || v[0] < -limit || v[1] > limit)) throw new Error('big'); return v; };
  const atom = () => { const t = toks[p++]; if (t === '(') { const e = sum(); p++; return e; } if (t === '-') { const [n, d] = atom(); return [-n, d]; } return [B(t), 1n]; };
  const prod = () => { let l = atom(); while (toks[p] === '*' || toks[p] === '/') { const op = toks[p++], r = atom(); l = op === '*' ? norm(l[0] * r[0], l[1] * r[1]) : norm(l[0] * r[1], l[1] * r[0]); } return l; };
  const sum = () => { let l = prod(); while (toks[p] === '+' || toks[p] === '-') { const op = toks[p++], r = prod(); l = norm(op === '+' ? l[0] * r[1] + r[0] * l[1] : l[0] * r[1] - r[0] * l[1], l[1] * r[1]); } return l; };
  try { const [n, d] = sum(); return d === 1n ? String(n) : `${n}/${d}`; } catch (e) { return e.message; }
}
function fracTests() {
  const r = rng(77), tests = [];
  const gen = (d) => {
    if (d === 0 || r() < 0.25) return String(int(r, 0, 12));
    const x = r();
    if (x < 0.12) return `-${gen(d - 1)}`.replace(/^--/, '- -');
    if (x < 0.3) return `(${gen(d - 1)})`;
    const sp = r() < 0.3 ? ' ' : '';
    return `${gen(d - 1)}${sp}${pick(r, ['+', '-', '*', '/', '/'])}${sp}${gen(d - 1)}`;
  };
  while (tests.length < 26) {
    const e = gen(4);
    if (e.length < 5 || e.length > 44 || /--/.test(e)) continue;
    const v = fracCalc(e, 1000000n);
    if (v === 'big' || (v === 'div0' && r() < 0.7)) continue;
    tests.push([e]);
  }
  return [['0'], ['7'], ['1/2'], ['2/4'], ['-1/2'], ['1/-2'], ['-(1/2)'], ['1/3+1/6'], ['1/2-1/2'], ['3/4*4/3'], ['1/2/2'], ['1/(2/2)'], ['2-3-4'], ['1/0'], ['5/(1/2-2/4)'], ['0/5'], [' ( 1 + 2 ) / ( 3 - 7 ) '], ['2*-3'], ['- -3'], ['7/2*2/7-1'], ['1/3+1/3+1/3'], ['999/1000*1000/999'], ...tests];
}

// ---------------------------------------------------------------- big_divmod
const bigDivmod = (a, b) => `${B(a) / B(b)} ${B(a) % B(b)}`;
function divTests() {
  const r = rng(5), tests = [];
  const num = (digits) => { let s = String(int(r, 1, 9)); for (let i = 1; i < digits; i++) s += int(r, 0, 9); return (r() < 0.35 ? '-' : '') + s; };
  for (let i = 0; i < 22; i++) tests.push([num(int(r, 1, 50)), num(int(r, 1, i % 3 === 0 ? 3 : 30))]);
  return [['0', '1'], ['0', '-7'], ['7', '2'], ['-7', '2'], ['7', '-2'], ['-7', '-2'], ['6', '3'], ['-6', '3'], ['1', '5'], ['-1', '5'], ['5', '5'], ['4', '5'],
    ['100000000000000000000000000000', '1'], ['100000000000000000000000000000', '-1'], ['100000000000000000000000000000', '100000000000000000000000000001'],
    ['99999999999999999999999999999999999999', '9999999999999999999'], ['1000000000000000000000000', '10'], ['-1000000000000000000000001', '1000000000000'],
    ['18446744073709551616', '4294967296'], ['123456789', '123456789123456789'], ...tests];
}

// ---------------------------------------------------------------- schedule
function schedule(s) {
  const good = []; let invalid = 0;
  for (const e of s === '' ? [] : s.split(',')) {
    const m = /^([0-9]{2}):([0-9]{2})-([0-9]{2}):([0-9]{2})$/.exec(e);
    const v = m ? m.slice(1).map(Number) : null;
    if (!v || v[0] > 23 || v[2] > 23 || v[1] > 59 || v[3] > 59 || v[2] * 60 + v[3] <= v[0] * 60 + v[1]) { invalid++; continue; }
    good.push([v[0] * 60 + v[1], v[2] * 60 + v[3]]);
  }
  good.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const [a, b] of good) { const last = merged[merged.length - 1]; if (last && a <= last[1]) last[1] = Math.max(last[1], b); else merged.push([a, b]); }
  const f = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  return `${merged.map(([a, b]) => `${f(a)}-${f(b)}`).join(',')};total=${merged.reduce((t, [a, b]) => t + b - a, 0)};invalid=${invalid}`;
}

// ---------------------------------------------------------------- sat
function sat(n, clauses) {
  const cs = []; let cur = [];
  for (const x of clauses) { if (x === 0) { cs.push(cur); cur = []; } else cur.push(x); }
  for (let m = 0; m < 2 ** n; m++) {
    const val = (v) => (m >> (n - v)) & 1;
    if (cs.every((c) => c.some((l) => (l > 0 ? val(l) === 1 : val(-l) === 0)))) return Array.from({ length: n }, (_, i) => val(i + 1));
  }
  return [-1];
}
function satTests() {
  const r = rng(99), tests = [];
  for (let i = 0; i < 14; i++) {
    const n = int(r, 2, 10), m = int(r, n, n * 3), cl = [];
    for (let c = 0; c < m; c++) { for (let k = int(r, 1, 3); k > 0; k--) cl.push(int(r, 1, n) * (r() < 0.5 ? 1 : -1)); cl.push(0); }
    tests.push([n, cl]);
  }
  return [[1, []], [3, []], [1, [1, 0]], [1, [-1, 0]], [1, [1, 0, -1, 0]], [2, [0]], [2, [1, 2, 0]], [2, [1, 2, 0, -2, 0]], [3, [-1, -2, 0, -1, -3, 0, 1, 0]], [3, [1, 1, 0, 1, -1, 0, 3, 0]],
    [2, [1, 2, 0, 1, -2, 0, -1, 2, 0, -1, -2, 0]], [12, [12, 0]], [12, [-12, 0, 1, 12, 0]], [4, [1, -1, 0]], ...tests];
}

// ---------------------------------------------------------------- to_infix
function toInfix(postfix) {
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }, st = [];
  for (const t of postfix.split(' ')) {
    if (!prec[t]) { st.push({ s: t, p: 9 }); continue; }
    const r = st.pop(), l = st.pop(), p = prec[t];
    const wrapL = l.p < p || (l.p === p && t === '^');
    const wrapR = r.p < p || (r.p === p && (t === '-' || t === '/'));
    st.push({ s: `${wrapL ? `(${l.s})` : l.s}${t}${wrapR ? `(${r.s})` : r.s}`, p });
  }
  return st[0].s;
}
function infixTests() {
  const r = rng(31), tests = [];
  const gen = (d) => (d === 0 || r() < 0.2 ? pick(r, ['a', 'b', 'c', 'd', 'x', 'y']) : `${gen(d - 1)} ${gen(d - 1)} ${pick(r, ['+', '-', '*', '/', '^'])}`);
  while (tests.length < 22) { const e = gen(4); if (e.length >= 5 && e.length <= 45) tests.push([e]); }
  return [['a'], ['a b +'], ['a b + c *'], ['a b c * +'], ['a b c + -'], ['a b - c -'], ['a b c - -'], ['a b c / /'], ['a b / c /'], ['a b c + +'], ['a b c - +'], ['a b c / *'], ['a b * c /'],
    ['a b ^ c ^'], ['a b c ^ ^'], ['a b + c ^'], ['a b c + ^'], ['a b * c ^'], ['a b ^ c *'], ['a b - c d - -'], ['a b + c d + *'], ['a b c d ^ ^ ^'], ...tests];
}

export const TASKS = [
  {
    id: 'interp', params: [['src', 'Str']], ret: 'Str',
    desc: 'Run a program in a small language and return what it prints. A program is a sequence of statements. Statements: `NAME = EXPR;` (assignment), `print EXPR;`, `while EXPR { STATEMENTS }`, and `if EXPR { STATEMENTS }` optionally followed by `else { STATEMENTS }`. Blocks may be empty and may nest. Expressions, from loosest to tightest binding: one optional comparison `< <= > >= == !=` between two sums (comparisons do not chain; the result is 1 for true and 0 for false); `+ -` (left to right); `* / %` (left to right); unary minus (may repeat); then integer literals, variable names and parenthesised expressions. `/` truncates toward zero and `%` takes the sign of its left operand. A condition counts as true when it is not zero. Names are one or more lower-case letters; `print`, `while`, `if` and `else` are never variable names. Tokens may be separated by any number of spaces, or by none where that is unambiguous (`x=-3;` and `a<=b` are fine). The result is the printed values joined by `,`. Three errors stop the program, and the error name is then added as one more item at the end of the result: `!undef` when a variable is read before it was assigned; `!div0` when the right operand of `/` or `%` is zero; `!steps` when the program would take more than 5000 steps, where each executed assignment, print or if statement is one step and each evaluation of a while condition is one step. Operands are evaluated left to right, and both operands are always evaluated. The program is always well-formed, and every value fits in a signed 64-bit integer.',
    ref: interp,
    tests: [[''], ['print 1+2*3;'], ['x=5;print x;print x*x;'], ['x = 10 ; while x > 7 { print x ; x = x - 1 ; }'], ['i=0;s=0;while i<10{i=i+1;if i%2==0{s=s+i;}}print s;'], ['print y;'], ['x=1;print x;print x/(x-1);print 5;'], ['while 1 {}'],
      ['x=0;while x<2498{x=x+1;}print x;'], ['x=0;while x<2499{x=x+1;}'], ['x=0;while x<2499{x=x+1;}print x;'], ['if 0 {print 1;} else {print 2;}'], ['if 3 {print 1;}'], ['if 0 {print 1;}print 9;'], ['print -7/2;print -7%3;print 7%-3;print --4;'], ['print 1<2;print 2<1;print 2<=2;print 3!=3;print 3==3;print 1+1>=2;'],
      ['print (1<2)+(2<3);'], ['a=1;b=a+a;c=b*b+a;print c;'], ['n=5;f=1;while n>0{f=f*n;n=n-1;}print f;'], ['a=0;b=1;i=0;while i<20{print a;t=a+b;a=b;b=t;i=i+1;}'], ['x=3;if x>2{if x>5{print 1;}else{print 2;}}else{print 3;}'],
      ['print 1;print z+1/0;'], ['print 1/0+z;'], ['x=1;if x{x=y;}print x;'], ['i=0;while i<3{j=0;while j<3{if i==j{print i*10+j;}j=j+1;}i=i+1;}'], ['ifx=4;printx=ifx+1;print printx;'], ['x=9223372036854775807;print x;print -x-1;'],
      ['n=27;c=0;while n!=1{if n%2==0{n=n/2;}else{n=3*n+1;}c=c+1;}print c;'], ['i=0;while i<1000{i=i+1;if i%250==0{print i;}}'], ['x=5;while x{x=x-1;}print x;'], ['print 2*(3+4)*(5-(6-7));'], ['a=7;a=a%4*3-a;print a;'], ['i=0;while i<4999{i=i+1;}']],
  },
  {
    id: 'json_canon', params: [['s', 'Str']], ret: 'Str',
    desc: "Check a document in a JSON-like format and return it in canonical form, or `error` if it is not valid. A value is one of: an object `{ KEY : VALUE , ... }` whose keys are strings; an array `[ VALUE , ... ]`; a string, written between single quotes and containing any characters except a single quote (there are no escapes); an integer, written as an optional `-` followed by either `0` or digits that do not start with `0` (so `01`, `+1`, `-` and `1.5` are not valid); or one of the words `true`, `false`, `null`. Objects and arrays may be empty. Space characters may appear before and after any value, key, `:` , `,`, bracket or brace, but not inside a number or word. A trailing comma (`[1,]`), a missing comma or colon, and anything left over after the value are errors, as is an empty document. The canonical form has no spaces outside strings, writes strings with single quotes, writes integers in plain decimal (`-0` becomes `0`), and lists the keys of each object in ascending order by character code. If a key appears more than once in an object, only its last value is kept. Integers in valid documents fit in a signed 64-bit integer, and nesting is at most 20 deep.",
    ref: jsonCanon,
    tests: [[''], ['   '], ['1'], [' 42 '], ['-7'], ['-0'], ['0'], ['01'], ['-'], ['+1'], ['1.5'], ['1 2'], ['true'], ['null'], ['nul'], ['truefalse'], ["'hi there'"], ["'unterminated"], ["''"], ['[]'], ['[ ]'], ['{}'], ['{ }'], ['[1,2,3]'], ['[1, 2 ,3 ]'], ['[1,]'], ['[,1]'], ['[1 2]'], ['[1,2'], ['[[[]]]'], ['[[],[[]],{}]'],
      ["{'b':1,'a':2}"], ["{ 'b' : 1 , 'a' : [ true , null ] }"], ["{'a':1,'a':2}"], ["{'a':1,}"], ["{'a' 1}"], ["{a:1}"], ["{'a':}"], ["{'a':1 'b':2}"], ["{1:2}"], ["{'B':1,'a':2,'A':3,'':4,'aa':5}"], ["{'k':{'z':[1,{'y':'s p a c e','x':-12}],'m':false}}"], ["[' a ','b,c','{']"], ["{'a':[1,2,{'b':[]}]} x"], ["[true,false,null,0,-0,'']"],
      ["{'x':{'x':{'x':1,'w':2},'w':3},'w':4}"], ['[1,[2,[3,[4,]]]]'], ['[-1,-22,333]'], ['[- 1]'], ['[tru e]'], ["{'a':1}{'b':2}"], ["['a''b']"], [']'], ['[9223372036854775807,-9223372036854775808]']],
  },
  {
    id: 'regex_match', params: [['pattern', 'Str'], ['text', 'Str']], ret: 'Bool',
    desc: 'Return true if the whole of text matches the regular expression pattern. A pattern is made of: lower-case letters, which match themselves; `.`, which matches any one character; `X*` (zero or more), `X+` (one or more) and `X?` (zero or one), where X is a letter, `.` or a parenthesised group; parentheses for grouping; and `|` for alternatives, which binds loosest. An alternative may be empty, so `a|` matches `a` or the empty text, and `()` is an empty group. The empty pattern matches only the empty text. The pattern is always well-formed (balanced parentheses, and every `* + ?` directly follows a letter, a `.` or a `)`). The pattern is at most 30 characters and the text at most 40 lower-case letters. Your function must answer quickly for every such input: each test has a time limit of a few seconds.',
    ref: regexMatch,
    tests: regexTests(),
  },
  {
    id: 'sheet', params: [['cells', 'Str']], ret: 'Str',
    desc: 'Evaluate a small spreadsheet. The input is a list of assignments separated by `;`, each `NAME=FORMULA`. A cell name is an upper-case letter followed by a digit from 1 to 9. A formula has no spaces and is built from non-negative integer literals, cell names, the binary operators `+ - *` (`*` binds tighter; operators of the same level go left to right), unary minus (which binds tighter than any binary operator and may repeat), and parentheses. If a cell is assigned more than once, the last assignment counts. A cell that is used in a formula but never assigned has the value 0. A cell has the value `#CYCLE` if working out its value would need its own value, directly or through other cells, or would need the value of any cell that is `#CYCLE`. Return every assigned cell, in ascending order of name by character code, as `NAME=VALUE`, joined by `,`. The empty input gives the empty string. All values fit in a signed 64-bit integer.',
    ref: sheet,
    tests: [[''], ['A1=3'], ['A1=1+2*3'], ['B1=A1+2*C1;A1=3;C1=4'], ['A1=B7'], ['A1=A1'], ['A1=B1;B1=A1'], ['A1=B1;B1=C1;C1=A1;D1=5'], ['A1=B1+1;B1=B1;C1=2'], ['A1=1;A1=2;B1=A1'], ['A1=A1;A1=5'], ['A1=5;A1=A1'],
      ['Z9=1;A1=2;M5=3;A2=4;B1=5'], ['A1=-3;B1=--A1;C1=-(A1-B1)*-2'], ['A1=2*(3+4)*(5-(6-7))'], ['A1=10-4-3;B1=2*3*4;C1=10-(4-3)'], ['A1=B1*0;B1=B1'], ['A1=B1;B1=C1;C1=D1;D1=7'], ['D1=C1+1;C1=B1+1;B1=A1+1;A1=1'], ['A1=B1+C1;B1=D1;C1=D1;D1=E1+1'],
      ['A1=B1;B1=A1;C1=A1+1;D1=C1;E1=4;F1=E1+Q1'], ['A1=B1;B1=C1;C1=B1;D1=3'], ['A1=1;B1=A1+A1;C1=B1+B1;D1=C1+C1;E1=D1+D1;F1=E1*E1*E1'], ['A1=3037000499*3037000499'], ['A1=-B1;B1=-9'], ['A1=2-3-4*5*6+7'], ['B2=B3;B3=B4;B4=B2;B5=B9;B6=B5+B2']],
  },
  {
    id: 'toposort', params: [['n', 'Int'], ['edges', '[Int]']], ret: '[Int]',
    desc: 'Tasks are numbered 0 to n-1 (n is at least 1). edges lists pairs of numbers: each pair a, b means task a must be done before task b. Pairs may repeat. Return an order of all tasks built this way: repeatedly take the lowest-numbered task that has not been taken and whose prerequisites have all been taken. If at some point no task can be taken (the requirements contain a cycle, which includes a task that must come before itself), return an array holding the single number -1.',
    ref: toposort,
    tests: [[1, []], [3, []], [2, [1, 0]], [3, [2, 1, 1, 0]], [4, [3, 0, 3, 0, 0, 1]], [2, [0, 1, 1, 0]], [1, [0, 0]], [5, [0, 4, 4, 1, 1, 3, 3, 2]], [6, [5, 2, 5, 0, 4, 0, 4, 1, 2, 3, 3, 1]], [4, [0, 1, 1, 2, 2, 1]], [5, [4, 3, 2, 3, 3, 1]], [7, [6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0]], [4, [1, 2, 0, 3, 3, 2, 2, 3]], [8, [7, 0, 6, 0, 5, 1, 4, 1, 0, 2, 1, 2, 2, 3]]],
  },
  {
    id: 'frac_calc', params: [['s', 'Str']], ret: 'Str',
    desc: 'Evaluate an arithmetic expression exactly, with fractions. The expression has non-negative integer literals, the binary operators `+ - * /` (`* /` bind tighter; operators of the same level go left to right), unary minus (which binds tighter than any binary operator and may repeat), parentheses, and spaces anywhere between tokens. `/` is exact division, so `1/2` is one half. Return the result in lowest terms: as `N/D` with D at least 2, or as just `N` when it is a whole number; a negative result has its `-` in front (`-1/2`), and zero is `0`. If any division has a divisor equal to zero, return `div0`. The expression is always well-formed. Every intermediate result, written in lowest terms, has a numerator and denominator below one million in absolute value.',
    ref: (s) => fracCalc(s),
    tests: fracTests(),
  },
  {
    id: 'big_divmod', params: [['a', 'Str'], ['b', 'Str']], ret: 'Str',
    desc: 'a and b are integers written in decimal with up to 50 digits, an optional leading `-`, and no leading zeros (zero is `0`). b is not zero. Divide a by b, rounding the quotient toward zero, and return the quotient and the remainder separated by one space. The remainder has the sign of a (or is zero), so that a = quotient * b + remainder; for example -7 and 2 give `-3 -1`. Both numbers are written without leading zeros, and zero is always `0`, never `-0`.',
    ref: bigDivmod,
    tests: divTests(),
  },
  {
    id: 'schedule', params: [['s', 'Str']], ret: 'Str',
    desc: 'The input is a list of time ranges separated by `,`. A valid range is exactly `HH:MM-HH:MM`: two digits, a colon, two digits, a dash, and the same again, with hours from 00 to 23, minutes from 00 to 59, and an end time later than the start time. Any other entry (including an empty one, or one containing spaces) is invalid and is only counted. Merge the valid ranges: ranges that overlap or touch (one ends exactly when another starts) become one range. Return the merged ranges in ascending order joined by `,`, followed by `;total=` and the number of minutes they cover, followed by `;invalid=` and the number of invalid entries. The empty string has no entries and gives `;total=0;invalid=0`.',
    ref: schedule,
    tests: [[''], ['09:00-10:00'], ['09:00-10:00,10:00-11:00'], ['09:00-10:00,10:01-11:00'], ['10:00-11:00,09:00-10:30'], ['09:00-17:00,10:00-11:00,12:00-13:00'], ['09:00-09:00'], ['10:00-09:00'], ['9:00-10:00'], ['09:00-24:00'], ['09:60-10:00'], ['09:00-10:00,'], [','], ['09:00 -10:00'], ['09:00-10:00,09:00-10:00'],
      ['00:00-23:59'], ['23:00-23:59,00:00-00:01'], ['13:00-14:00,09:00-10:00,11:00-12:00,10:00-11:00'], ['08:00-09:00,08:30-08:45,08:45-09:30,09:30-09:31'], ['ab:cd-ef:gh,12:00-12:01'], ['12:00-12:01-12:02'], ['12:00_12:30'], ['01:00-02:00,03:00-04:00,02:00-03:00,05:00-06:00,x'], ['09:00-10:00,009:00-10:00'], ['10:00-10:59,10:59-11:00,11:01-11:02']],
  },
  {
    id: 'sat', params: [['n', 'Int'], ['clauses', '[Int]']], ret: '[Int]',
    desc: 'A logic formula has variables numbered 1 to n (n is between 1 and 12). clauses holds its clauses one after another, each ended by a 0. Inside a clause, the number v stands for "variable v is true" and -v for "variable v is false"; a clause is satisfied when at least one of its entries holds. A clause with no entries can never be satisfied. Find an assignment that satisfies every clause and return it as an array of n numbers, 1 for true and 0 for false, with variable 1 first. If several assignments work, return the one that comes first when the arrays are compared entry by entry from the left, with 0 before 1. If none works, return an array holding the single number -1. With no clauses, every assignment works.',
    ref: sat,
    tests: satTests(),
  },
  {
    id: 'to_infix', params: [['postfix', 'Str']], ret: 'Str',
    desc: 'Convert an expression from postfix notation to ordinary infix notation with as few parentheses as the following rules allow. The input is tokens separated by single spaces: operands are single lower-case letters and the operators are `+ - * / ^`, each taking two operands (the first operand is the one that was pushed earlier). Precedence: `^` binds tightest, then `*` and `/`, then `+` and `-`. The output has no spaces. An operand that is itself an operation is put in parentheses in exactly these cases: its operator has lower precedence than the operator it is an operand of; or the two have the same precedence and it is the right operand of `-` or `/`; or the two have the same precedence and it is the left operand of `^`. The input is always a valid postfix expression.',
    ref: toInfix,
    tests: infixTests(),
  },
];
