// Harder tasks for the agent benchmark: each needs a real program (a parser, an interpreter, a
// simulation, a graph search) or has edge cases that are easy to get silently wrong.
// Same shape as tasks.mjs: statement, signature, reference implementation, hidden tests.
// Types: Int, Bool, Str, [Int]. Strings in tests are plain ASCII.

const B = BigInt;
const MAX = 2n ** 63n - 1n, MIN = -(2n ** 63n);
const fits = (v) => v >= MIN && v <= MAX;

function evalExpr(s) {
  let i = 0;
  const ws = () => { while (s[i] === ' ') i++; };
  const primary = () => {
    ws();
    if (s[i] === '(') { i++; const v = expr(); ws(); i++; return v; }
    let j = i; while (s[j] >= '0' && s[j] <= '9') j++;
    const v = B(s.slice(i, j)); i = j; return v;
  };
  const unary = () => { ws(); if (s[i] === '-') { i++; return -unary(); } return primary(); };
  const term = () => {
    let v = unary();
    for (;;) {
      ws(); const op = s[i];
      if (op !== '*' && op !== '/' && op !== '%') return v;
      i++; const r = unary();
      if (op === '*') v *= r; else { if (r === 0n) throw new Error('div0'); v = op === '/' ? v / r : v % r; }
    }
  };
  const expr = () => {
    let v = term();
    for (;;) { ws(); const op = s[i]; if (op !== '+' && op !== '-') return v; i++; const r = term(); v = op === '+' ? v + r : v - r; }
  };
  try { return String(expr()); } catch { return 'div0'; }
}

function stackVm(program) {
  const code = program === '' ? [] : program.split(';').map((x) => x.split(' '));
  const st = [], out = [];
  let pc = 0, steps = 0;
  const done = (e) => [...out, ...(e ? [e] : [])].join(',');
  while (pc < code.length) {
    if (++steps > 1000) return done('!steps');
    const [op, arg] = code[pc]; pc++;
    const need = { add: 2, sub: 2, mul: 2, swap: 2, dup: 1, pop: 1, out: 1, jz: 1 }[op] ?? 0;
    if (st.length < need) return done('!stack');
    if (op === 'push') st.push(B(arg));
    else if (op === 'add') { const b = st.pop(), a = st.pop(); st.push(a + b); }
    else if (op === 'sub') { const b = st.pop(), a = st.pop(); st.push(a - b); }
    else if (op === 'mul') { const b = st.pop(), a = st.pop(); st.push(a * b); }
    else if (op === 'dup') st.push(st[st.length - 1]);
    else if (op === 'swap') { const b = st.pop(), a = st.pop(); st.push(b, a); }
    else if (op === 'pop') st.pop();
    else if (op === 'out') out.push(String(st.pop()));
    else if (op === 'halt') return done();
    else if (op === 'jmp' || op === 'jz') {
      const take = op === 'jmp' || st.pop() === 0n;
      if (take) { const k = Number(arg); if (k < 0 || k > code.length) return done('!jump'); pc = k; }
    }
  }
  return done();
}

function ledger(ops) {
  const acc = new Map(); let rejected = 0;
  for (const line of ops === '' ? [] : ops.split(';')) {
    const [op, a, b, c] = line.split(' ');
    let ok = false;
    if (op === 'open') { if (!acc.has(a)) { acc.set(a, 0); ok = true; } }
    else if (op === 'close') { if (acc.get(a) === 0) { acc.delete(a); ok = true; } }
    else if (op === 'deposit') { const n = Number(b); if (acc.has(a) && n > 0) { acc.set(a, acc.get(a) + n); ok = true; } }
    else if (op === 'withdraw') { const n = Number(b); if (acc.has(a) && n > 0 && acc.get(a) >= n) { acc.set(a, acc.get(a) - n); ok = true; } }
    else if (op === 'transfer') { const n = Number(c); if (acc.has(a) && acc.has(b) && a !== b && n > 0 && acc.get(a) >= n) { acc.set(a, acc.get(a) - n); acc.set(b, acc.get(b) + n); ok = true; } }
    if (!ok) rejected++;
  }
  return `${[...acc.keys()].sort().map((k) => `${k}=${acc.get(k)}`).join(',')};rejected=${rejected}`;
}

function det(xs, n) {
  const m = Array.from({ length: n }, (_, r) => xs.slice(r * n, r * n + n));
  const go = (a) => {
    if (a.length === 1) return a[0][0];
    let t = 0;
    for (let c = 0; c < a.length; c++) t += (c % 2 ? -1 : 1) * a[0][c] * go(a.slice(1).map((row) => row.filter((_, j) => j !== c)));
    return t;
  };
  return go(m);
}

function life(cells, w, h, steps) {
  let g = cells.slice();
  for (let s = 0; s < steps; s++) {
    const next = g.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if ((dy || dx) && yy >= 0 && yy < h && xx >= 0 && xx < w) n += g[yy * w + xx];
      }
      next[y * w + x] = n === 3 || (n === 2 && g[y * w + x] === 1) ? 1 : 0;
    }
    g = next;
  }
  return g;
}

function shortestPath(n, edges) {
  const dist = Array(n).fill(Infinity), seen = Array(n).fill(false); dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!seen[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    seen[u] = true;
    for (let e = 0; e < edges.length; e += 3) {
      const [a, b, w] = edges.slice(e, e + 3);
      if (a === u) dist[b] = Math.min(dist[b], dist[u] + w);
      if (b === u) dist[a] = Math.min(dist[a], dist[u] + w);
    }
  }
  return dist[n - 1] === Infinity ? -1 : dist[n - 1];
}

function checkedPoly(coeffs, x) {
  let acc = 0n;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    acc *= B(x); if (!fits(acc)) return 'overflow';
    acc += B(coeffs[i]); if (!fits(acc)) return 'overflow';
  }
  return String(acc);
}

function addDays(y, m, d, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  const p = (v, k) => String(v).padStart(k, '0');
  return `${p(t.getUTCFullYear(), 4)}-${p(t.getUTCMonth() + 1, 2)}-${p(t.getUTCDate(), 2)}`;
}

function groupCsv(s) {
  const sums = new Map(); let bad = 0;
  for (const raw of s.split('|')) {
    if (raw.trim() === '') continue;
    const f = raw.split(',').map((x) => x.trim());
    if (f.length !== 2 || !/^[A-Za-z]+$/.test(f[0]) || !/^-?[0-9]+$/.test(f[1])) { bad++; continue; }
    sums.set(f[0], (sums.get(f[0]) ?? 0) + Number(f[1]));
  }
  return `${[...sums.keys()].sort().map((k) => `${k}=${sums.get(k)}`).join(',')};bad=${bad}`;
}

function lru(capacity, ops) {
  const m = new Map(), out = [];
  for (let i = 0; i < ops.length;) {
    if (ops[i] === 0) {
      const k = ops[i + 1]; i += 2;
      if (m.has(k)) { const v = m.get(k); m.delete(k); m.set(k, v); out.push(v); } else out.push(-1);
    } else {
      const k = ops[i + 1], v = ops[i + 2]; i += 3;
      m.delete(k); m.set(k, v);
      if (m.size > capacity) m.delete(m.keys().next().value);
    }
  }
  return out;
}

function wrap(s, width) {
  const words = s.split(' ').filter((x) => x !== '').flatMap((x) => x.match(new RegExp(`.{1,${width}}`, 'g')));
  const lines = [];
  for (const x of words) {
    if (lines.length && lines[lines.length - 1].length + 1 + x.length <= width) lines[lines.length - 1] += ` ${x}`;
    else lines.push(x);
  }
  return lines.join('|');
}

function longestValid(s) {
  const pair = { ')': '(', ']': '[', '}': '{' };
  let best = 0;
  for (let a = 0; a < s.length; a++) {
    const st = [];
    for (let b = a; b < s.length; b++) {
      const ch = s[b];
      if (pair[ch]) { if (st.pop() !== pair[ch]) break; } else st.push(ch);
      if (st.length === 0) best = Math.max(best, b - a + 1);
    }
  }
  return best;
}

export const TASKS = [
  {
    id: 'eval_expr', params: [['s', 'Str']], ret: 'Str',
    desc: 'Evaluate an integer arithmetic expression and return the result as a decimal string. The expression has non-negative integer literals, the binary operators `+ - * / %`, unary minus (which may be repeated, as in `--5`, and may follow a binary operator, as in `2*-3`), parentheses, and spaces anywhere between tokens. `* / %` bind tighter than `+ -`, operators of the same level associate left to right, and unary minus binds tighter than any binary operator. `/` truncates toward zero and the result of `%` has the sign of its left operand, so `-7/2` is -3 and `-7%3` is -1. If any division or remainder has a zero right operand, return `"div0"`. The expression is always well-formed and every intermediate value fits in a signed 64-bit integer.',
    ref: evalExpr,
    tests: [['1+2*3'], [' ( 1 + 2 ) * 3 '], ['-7/2'], ['7%-3'], ['-7%3'], ['2*(3-(4+5))*-1'], ['10/(5-5)'], ['--5'], ['9223372036854775807'], ['100/7/2'], ['2-3-4'], ['8%(3-3)+1'], ['-(2+3)*-(4)'], ['0'], ['1000000007*1000000007%998244353']],
  },
  {
    id: 'stack_vm', params: [['program', 'Str']], ret: 'Str',
    desc: 'Run a program for a small stack machine and return what it printed. Instructions are separated by `;` and numbered from 0; an instruction and its argument are separated by one space. Instructions: `push N` (N is an integer, possibly negative), `add`, `sub`, `mul` (pop b, then pop a, push a+b, a-b or a*b), `dup` (push a copy of the top value), `swap` (exchange the top two values), `pop` (discard the top value), `out` (pop a value and print it), `jmp K` (continue at instruction K), `jz K` (pop a value; if it is zero continue at instruction K), `halt` (stop). Execution starts at instruction 0 and also stops when it runs past the last instruction. The result is the printed values in order, joined by `,`. Three errors stop the program; the error name is then added as one more item at the end of the result: `!stack` if an instruction needs more values than the stack holds (nothing is popped in that case), `!jump` if a jump that is taken has a target below 0 or above the number of instructions (a target equal to the number of instructions is allowed and ends the program), and `!steps` if the program would execute more than 1000 instructions (the first 1000 are executed normally). The empty program prints nothing. All values fit in a signed 64-bit integer.',
    ref: stackVm,
    tests: [[''], ['push 2;push 3;add;out'], ['push 10;push 4;sub;out;push -3;push 5;mul;out'], ['push 3;dup;out;push 1;sub;dup;jz 8;jmp 1;halt;out'], ['push 1;add'], ['push 7;out;pop'], ['jmp 0'], ['push 5;out;jmp 9'], ['push 0;jz 4;push 1;out;push 2;out'], ['push 1;jz 99;push 4;out;jmp 5'], ['push 1;push 2;swap;out;out;halt;push 9;out'], ['push 1;out;jmp 3;halt'], ['push 0;jz -1'], ['push 6;push 1;swap;dup;jz 14;dup;push -1;add;swap;pop;swap;push 2;mul;jmp 2;pop;out']],
  },
  {
    id: 'ledger', params: [['ops', 'Str']], ret: 'Str',
    desc: 'Process bank operations and report the final balances. Operations are separated by `;`, and the words of an operation by one space. `open NAME` creates an account with balance 0; it is rejected if the account exists. `deposit NAME AMOUNT` and `withdraw NAME AMOUNT` are rejected if the account does not exist or AMOUNT is not positive; a withdrawal is also rejected if the balance is smaller than AMOUNT. `transfer FROM TO AMOUNT` is rejected if either account does not exist, if FROM and TO are the same, if AMOUNT is not positive, or if the balance of FROM is smaller than AMOUNT. `close NAME` removes an account; it is rejected if the account does not exist or its balance is not zero. A rejected operation changes nothing. Names are lower-case letters; amounts are integers, possibly written with a leading `-`. Return the accounts that exist at the end, sorted by name, each as `name=balance`, joined by `,`, followed by `;rejected=` and the number of rejected operations. With no accounts the result starts with the `;`. The empty string contains no operations.',
    ref: ledger,
    tests: [[''], ['open a'], ['open bob;open al;deposit bob 50;transfer bob al 20'], ['deposit x 5'], ['open a;open a;deposit a 0;deposit a -5;withdraw a 1'], ['open a;deposit a 10;withdraw a 10;close a'], ['open a;deposit a 10;close a;transfer a a 5'], ['open a;open b;deposit a 100;transfer a b 100;transfer a b 1;transfer b c 5;close a;open a;deposit a 7'], ['open zed;open amy;open kim;deposit kim 3;deposit amy 2;deposit zed 1;withdraw kim 4'], ['close q;open q;close q;close q']],
  },
  {
    id: 'det', params: [['xs', '[Int]'], ['n', 'Int']], ret: 'Int',
    desc: 'xs holds an n by n matrix of integers, row by row (so it has n*n elements). Return its determinant. n is between 1 and 6 and every element is between -50 and 50.',
    ref: det,
    tests: [[[7], 1], [[1, 2, 3, 4], 2], [[2, 0, 0, 0, 3, 0, 0, 0, 4], 3], [[1, 2, 3, 4, 5, 6, 7, 8, 9], 3], [[0, 1, 1, 0], 2], [[3, -2, 5, 1, 0, 4, -7, 6, 2], 3], [[1, 0, 2, -1, 3, 0, 0, 5, 2, 1, 4, -3, 1, 0, 5, 0], 4], [[50, -50, 50, -50, 50, 49, 50, -50, 50, -50, 48, 50, 50, -50, 50, 47, 50, -50, 50, -50, 46, 50, 50, -50, 50], 5], [[0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 5, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0], 6], [[4, 7, -3, 9, 1, 0, 2, 5, -8, 6, 3, 3, 1, 1, 4, -2, 0, 7, 5, 5, 9, -6, 2, 8, 1, -4, 3, 0, 6, 2, 7, 7, -5, 4, 1, 3], 6]],
  },
  {
    id: 'life', params: [['cells', '[Int]'], ['w', 'Int'], ['h', 'Int'], ['steps', 'Int']], ret: '[Int]',
    desc: "cells holds a grid of w columns and h rows, row by row, with 1 for a live cell and 0 for a dead one. Return the grid after `steps` generations of Conway's Game of Life. A live cell with 2 or 3 live neighbours stays alive; a dead cell with exactly 3 live neighbours becomes alive; every other cell is dead in the next generation. Each cell has up to 8 neighbours, and cells outside the grid count as dead (the grid does not wrap around). w and h are at least 1 and steps is at least 0.",
    ref: life,
    tests: [[[1], 1, 1, 0], [[1], 1, 1, 1], [[0, 1, 0, 0, 1, 0, 0, 1, 0], 3, 3, 1], [[0, 1, 0, 0, 1, 0, 0, 1, 0], 3, 3, 2], [[1, 1, 1, 1], 2, 2, 5], [[0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0], 4, 4, 2], [[1, 1, 1, 0, 0], 5, 1, 1], [[1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], 3, 4, 3], [[0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0], 5, 5, 4]],
  },
  {
    id: 'shortest_path', params: [['n', 'Int'], ['edges', '[Int]']], ret: 'Int',
    desc: 'A graph has nodes 0 to n-1. edges lists its roads three numbers at a time: two node numbers and a length (so the array length is a multiple of 3). Roads can be used in both directions, lengths are zero or more, there may be several roads between the same two nodes, and a road may join a node to itself. Return the length of the shortest route from node 0 to node n-1, or -1 if there is none. n is at least 1; when n is 1 the answer is 0.',
    ref: shortestPath,
    tests: [[1, []], [2, []], [2, [0, 1, 5]], [2, [1, 0, 5, 0, 1, 3]], [3, [0, 1, 4, 1, 2, 4, 0, 2, 9]], [3, [0, 1, 4, 1, 2, 4, 0, 2, 7]], [4, [0, 1, 1, 2, 3, 1]], [5, [0, 1, 10, 0, 2, 3, 2, 1, 4, 1, 3, 2, 2, 3, 8, 3, 4, 7, 2, 4, 20]], [3, [0, 0, 1, 0, 1, 0, 1, 2, 0]], [6, [0, 1, 7, 0, 2, 9, 0, 5, 14, 1, 2, 10, 1, 3, 15, 2, 3, 11, 2, 5, 2, 3, 4, 6, 4, 5, 9]], [4, [3, 2, 1000000000000, 2, 1, 1000000000000, 1, 0, 1000000000000]]],
  },
  {
    id: 'checked_poly', params: [['coeffs', '[Int]'], ['x', 'Int']], ret: 'Str',
    desc: "coeffs[i] is the coefficient of x to the power i. Evaluate the polynomial with Horner's rule, exactly in this order: start with acc = 0; then for i from the last index down to 0, first multiply acc by x, then add coeffs[i]. Return the final acc as a decimal string. If the result of any of those multiplications or additions does not fit in a signed 64-bit integer, return `\"overflow\"` instead. An empty coeffs gives `\"0\"`.",
    ref: checkedPoly,
    tests: [[[], 5], [[7], 1000000], [[1, 2, 3], 10], [[0, 0, 0, 1], -3], [[9223372036854775807n], 0], [[9223372036854775807n, 1], 1], [[-1, 1], -9223372036854775807n], [[0, 0, 1], 3037000499], [[0, 0, 1], 3037000500], [[5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 100], [[-9223372036854775807n, 2], 4611686018427387904n], [[0, 4611686018427387904n], -2], [[1, 4611686018427387904n], -2], [[0, 1], B('-9223372036854775807') - 1n], [[3, -2, 1], -1000000000]],
  },
  {
    id: 'add_days', params: [['y', 'Int'], ['m', 'Int'], ['d', 'Int'], ['n', 'Int']], ret: 'Str',
    desc: 'y, m, d is a valid date in the Gregorian calendar (a year is a leap year if it is divisible by 4, except that years divisible by 100 are leap years only if divisible by 400). Return the date n days later (earlier if n is negative) as `YYYY-MM-DD`, with the year as 4 digits and the month and day as 2 digits. All dates involved are between the years 1600 and 2400.',
    ref: addDays,
    tests: [[2026, 11, 14, 0], [2026, 11, 14, 1], [2024, 2, 28, 1], [2023, 2, 28, 1], [1900, 2, 28, 1], [2000, 2, 28, 1], [2026, 12, 31, 1], [2026, 1, 1, -1], [2024, 3, 1, -1], [2000, 1, 1, 36525], [2026, 11, 14, -100000], [1600, 1, 1, 292193], [2100, 3, 1, -366], [1999, 12, 31, 60]],
  },
  {
    id: 'group_csv', params: [['s', 'Str']], ret: 'Str',
    desc: 'Rows are separated by `|`. A good row has exactly two fields separated by `,`: a key and an amount. Spaces around a field are ignored. The key must be one or more letters (a-z, A-Z; keys are case-sensitive) and the amount must be one or more digits with an optional leading `-`. A row that is empty or only spaces is skipped. Any other row that is not good is a bad row. Add up the amounts per key. Return the keys in ascending order by character code (so every upper-case letter sorts before every lower-case letter), each as `key=total`, joined by `,`, followed by `;bad=` and the number of bad rows. Every total fits in a signed 64-bit integer.',
    ref: groupCsv,
    tests: [[''], ['a,1'], ['b,2|a,3|b,-5'], [' x , 10 |x,5| |'], ['a,1,2|a|,5|a,|a,+5|a,-|a,1.5|a b,3|a1,3'], ['Zed,1|apple,2|Ant,3|zed,4'], ['k,-0|k,007'], ['a,1||b,2'], ['q, 4 2|q,42| q ,-42'], ['up,9000000000|up,9000000000|dn,-9000000000']],
  },
  {
    id: 'big_add', params: [['a', 'Str'], ['b', 'Str']], ret: 'Str',
    desc: 'a and b are integers written in decimal, of any length (up to 60 digits), with an optional leading `-` and no leading zeros (zero is written `0`). Return their sum in the same form: no leading zeros, and zero is `0`, never `-0`.',
    ref: (a, b) => String(B(a) + B(b)),
    tests: [['0', '0'], ['1', '2'], ['999', '1'], ['-5', '5'], ['-5', '3'], ['5', '-30'], ['-999', '-1'], ['123456789012345678901234567890', '987654321098765432109876543210'], ['100000000000000000000000000000000000000000', '-1'], ['-100000000000000000000000000000000000000000', '1'], ['99999999999999999999', '-99999999999999999998'], ['-18446744073709551616', '18446744073709551615'], ['7', '-100000000000000000007']],
  },
  {
    id: 'lru', params: [['capacity', 'Int'], ['ops', '[Int]']], ret: '[Int]',
    desc: 'Simulate a cache that holds at most `capacity` key-value pairs (capacity is at least 1). ops is read from left to right. A 0 is followed by a key: look the key up, and add its value to the result, or -1 if it is not in the cache. A 1 is followed by a key and a value: store the value under the key, replacing an existing value. Both a successful lookup and a store count as a use of that key. When a store of a new key makes the cache hold more than `capacity` pairs, the pair whose last use is oldest is removed. Return the lookup results in order.',
    ref: lru,
    tests: [[1, []], [2, [0, 5]], [2, [1, 1, 10, 1, 2, 20, 0, 1, 1, 3, 30, 0, 2, 0, 3, 0, 1]], [1, [1, 1, 10, 1, 2, 20, 0, 1, 0, 2]], [2, [1, 1, 10, 1, 1, 11, 1, 2, 20, 0, 1, 0, 2]], [2, [1, 1, 10, 1, 2, 20, 1, 1, 12, 1, 3, 30, 0, 1, 0, 2, 0, 3]], [3, [1, 1, 1, 1, 2, 2, 1, 3, 3, 0, 1, 0, 2, 1, 4, 4, 0, 3, 0, 4, 0, 1]], [2, [1, 0, -1, 0, 0, 1, -7, 0, 0, -7, 0, 9]], [2, [1, 1, 10, 1, 2, 20, 0, 9, 1, 3, 30, 0, 1, 0, 2, 0, 3]]],
  },
  {
    id: 'wrap', params: [['s', 'Str'], ['width', 'Int']], ret: 'Str',
    desc: 'Wrap text to lines of at most `width` characters (width is at least 1). Words in s are separated by one or more spaces, and s may start or end with spaces. First, every word longer than `width` is cut into pieces of exactly `width` characters (the last piece may be shorter), and each piece then counts as a word. Then lines are filled greedily: a word goes on the current line, after one space, if the line stays within `width`; otherwise it starts a new line. Return the lines joined by `|`. If s has no words, return the empty string.',
    ref: wrap,
    tests: [['', 5], ['   ', 5], ['hello', 5], ['hello world', 5], ['hello world', 11], ['hello world', 10], ['a b c d e', 3], ['  the  quick   brown fox ', 9], ['abcdefghij', 4], ['ab abcdefg x', 3], ['one two three four five six', 7], ['x', 1], ['ab cd', 1]],
  },
  {
    id: 'longest_valid', params: [['s', 'Str']], ret: 'Int',
    desc: 's consists only of the characters `( ) [ ] { }`. Return the length of the longest run of consecutive characters of s that is a correctly nested bracket sequence (every bracket closed by one of the same kind, in the right order). The empty string gives 0.',
    ref: longestValid,
    tests: [[''], ['('], ['()'], ['(]'], ['()[]{}'], ['([{}])'], ['(()'], [')()())'], ['([)]'], ['{[]}(]()[]'], ['((()))[['], ['(){[}]()()'], ['[[[[]]](())']],
  },
];
