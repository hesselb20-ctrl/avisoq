// Avisoq lexer: source text -> tokens.

export class AvisoqError extends Error {
  constructor(code, message, line, col, hint) {
    super(message);
    this.code = code;
    this.line = line;
    this.col = col;
    this.hint = hint;
  }
}

export const KEYWORDS = new Set([
  'fn', 'let', 'var', 'if', 'else', 'while', 'for', 'in', 'return', 'assert',
  'requires', 'ensures', 'uses', 'test', 'true', 'false', 'and', 'or', 'not', 'mut', 'struct', 'enum', 'match', 'import', 'invariant', 'private', 'break', 'continue',
]);

const OPS = ['->', '=>', '..', '.', '==', '!=', '<=', '>=', '+', '-', '*', '/', '%', '<', '>', '=',
  '(', ')', '{', '}', '[', ']', ',', ':', '?'];

const I64_MAX = (1n << 63n) - 1n;

export function lex(src) {
  const toks = [];
  const comments = [];
  let i = 0, line = 1, col = 1, nl = true;
  const isDigit = (c) => c >= '0' && c <= '9';
  const isIdStart = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  const push = (kind, value, pos, l, c) => {
    toks.push({ kind, value, pos, end: i, line: l, col: c, nl });
    nl = false;
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') { i++; line++; col = 1; nl = true; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; col++; continue; }
    if (ch === '/' && src[i + 1] === '/') {
      const start = i;
      while (i < src.length && src[i] !== '\n') i++;
      // own: nothing but whitespace before it on its line
      comments.push({ line, col, text: src.slice(start, i).trimEnd(), own: nl });
      continue;
    }
    const pos = i, l = line, c = col;
    if (isDigit(ch)) {
      while (i < src.length && (isDigit(src[i]) || src[i] === '_')) i++;
      let isFloat = false;
      if (src[i] === '.' && isDigit(src[i + 1] ?? '')) {
        isFloat = true;
        i++;
        while (i < src.length && isDigit(src[i])) i++;
        if (src[i] === 'e' || src[i] === 'E') {
          let j = i + 1;
          if (src[j] === '+' || src[j] === '-') j++;
          if (isDigit(src[j] ?? '')) {
            i = j;
            while (i < src.length && isDigit(src[i])) i++;
          }
        }
      }
      const text = src.slice(pos, i).replace(/_/g, '');
      col += i - pos;
      if (isFloat) {
        push('float', Number(text), pos, l, c);
        toks[toks.length - 1].raw = src.slice(pos, i);
      } else {
        const v = BigInt(text);
        if (v > I64_MAX + 1n) {
          throw new AvisoqError('E0002', `integer literal ${text} does not fit in Int (64-bit signed)`, l, c,
            'Int holds values from -9223372036854775808 to 9223372036854775807; std/math has checked_add, checked_sub and checked_mul for arithmetic that may not fit');
        }
        push('int', v, pos, l, c);
        toks[toks.length - 1].raw = src.slice(pos, i);
      }
      continue;
    }
    if (isIdStart(ch)) {
      while (i < src.length && (isIdStart(src[i]) || isDigit(src[i]))) i++;
      const text = src.slice(pos, i);
      col += i - pos;
      push(KEYWORDS.has(text) ? 'kw' : 'id', text, pos, l, c);
      continue;
    }
    if (ch === '"') {
      i++; col++;
      let s = '';
      for (;;) {
        if (i >= src.length || src[i] === '\n') {
          throw new AvisoqError('E0003', 'unterminated string literal', l, c, 'close the string with " on the same line');
        }
        if (src[i] === '"') { i++; col++; break; }
        if (src[i] === '\\') {
          const e = src[i + 1];
          const map = { n: '\n', t: '\t', '"': '"', '\\': '\\' };
          if (!(e in map)) {
            throw new AvisoqError('E0004', `unknown escape \\${e ?? ''}`, line, col, 'valid escapes are \\n \\t \\" \\\\');
          }
          s += map[e];
          i += 2; col += 2;
          continue;
        }
        s += src[i];
        i++; col++;
      }
      push('str', s, pos, l, c);
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      i += op.length; col += op.length;
      push('op', op, pos, l, c);
      continue;
    }
    throw new AvisoqError('E0001', `unexpected character '${ch}'`, l, c,
      ch === ';' ? 'Avisoq has no semicolons; put each statement on its own line'
        : ch === '&' || ch === '|' || ch === '!' ? 'use the keywords and, or, not for boolean logic'
          : undefined);
  }
  toks.comments = comments;
  toks.push({ kind: 'eof', value: '<end of file>', pos: i, end: i, line, col, nl: true });
  return toks;
}
