// Runtime failure kinds shared by both backends.

export const FAIL = { REQUIRES: 1, ENSURES: 2, ASSERT: 3, BOUNDS: 4, OVERFLOW: 5, DIVZERO: 6, ARRSIZE: 7, OOM: 8, KEY: 9, IO: 10, INVARIANT: 11, EXTERN: 12 };

const KIND = {
  [FAIL.REQUIRES]: ['precondition', (s) => `precondition violated: requires ${s.text}`],
  [FAIL.ENSURES]: ['postcondition', (s) => `postcondition violated: ensures ${s.text}`],
  [FAIL.ASSERT]: ['assert', (s) => `assertion failed: ${s.text}`],
  [FAIL.BOUNDS]: ['bounds', () => 'index out of bounds'],
  [FAIL.OVERFLOW]: ['overflow', () => 'integer overflow'],
  [FAIL.DIVZERO]: ['division_by_zero', () => 'division by zero'],
  [FAIL.ARRSIZE]: ['array_size', () => 'invalid array length (negative or too large)'],
  [FAIL.OOM]: ['out_of_memory', () => 'out of memory'],
  [FAIL.KEY]: ['missing_key', () => 'key not found in map'],
  [FAIL.INVARIANT]: ['invariant', (s) => `loop invariant violated: invariant ${s.text}`],
  [FAIL.IO]: ['io_error', () => 'file or network operation failed'],
  [FAIL.EXTERN]: ['unsupported', (s) => `extern function '${s.text}' is C code, which only the native backend can call: run with --native`],
};

// site: { fn, line, col, text }
export function failInfo(kind, site) {
  const [name, fmt] = KIND[kind];
  return { kind: name, message: fmt(site), ...(site.line ? { fn: site.fn, ...(site.file ? { file: site.file } : {}), line: site.line, col: site.col } : {}) };
}
