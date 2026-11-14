// Avisoq formatter: one canonical layout. Comments and blank-line grouping are kept.
import { parse } from './parser.mjs';
import { showType } from './types.mjs';

const WIDTH = 100;
const PREC = { or: 1, and: 2, '==': 4, '!=': 4, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
const fmtType = showType;
const quote = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;

function expr(e, min = 0) {
  const wrap = (p, s) => (p < min ? `(${s})` : s);
  switch (e.kind) {
    case 'IntLit': case 'FloatLit': return e.raw;
    case 'BoolLit': return e.value ? 'true' : 'false';
    case 'StrLit': return quote(e.value);
    case 'Name': return e.name;
    case 'MapLit': return '{}';
    case 'Lambda': return wrap(0.5, `fn(${e.params.map((p) => p.name).join(', ')}) => ${expr(e.body)}`);
    case 'Unary':
      return e.op === 'not' ? wrap(3, `not ${expr(e.operand, 3)}`) : wrap(7, `-${expr(e.operand, 7)}`);
    case 'Binary': {
      const p = PREC[e.op];
      // Comparisons do not chain, so both sides bind tighter; the rest associate to the left.
      // An 'and' inside an 'or' keeps its brackets: correct without them, but easy to misread.
      const group = (x, t) => (e.op === 'or' && x.kind === 'Binary' && x.op === 'and' ? `(${t})` : t);
      const left = group(e.left, expr(e.left, p === 4 ? 5 : p)), right = group(e.right, expr(e.right, p + 1));
      return wrap(p, `${left} ${e.op} ${right}`);
    }
    case 'Index': return `${expr(e.base, 8)}[${expr(e.index)}]`;
    case 'Field': return `${expr(e.base, 8)}.${e.name}`;
    case 'Call': return `${e.name}(${e.args.map((a) => expr(a)).join(', ')})`;
    case 'New': return `${e.name}(${e.fields.map((f) => `${f.name}: ${expr(f.expr)}`).join(', ')})`;
    case 'ArrayLit': return `[${e.elems.map((x) => expr(x)).join(', ')}]`;
    case 'Sum': return `sum(${e.name} in ${expr(e.start)}..${expr(e.end, 5)}: ${expr(e.body)})`;
    case 'Comp': return `[${e.name} in ${expr(e.start)}..${expr(e.end, 5)}: ${expr(e.body)}]`;
    default: throw new Error(`format: unknown expression ${e.kind}`);
  }
}

// A long call, constructor or array literal is broken one item per line.
function exprAt(e, prefix, indent) {
  const flat = expr(e);
  if (indent.length + prefix.length + flat.length <= WIDTH) return flat;
  const inner = `${indent}  `;
  const items = (list, f) => list.map((x) => `${inner}${f(x)},`).join('\n');
  if (e.kind === 'Call' && e.args.length) return `${e.name}(\n${items(e.args, (a) => exprAt(a, '', inner))}\n${indent})`;
  if (e.kind === 'New' && e.fields.length) return `${e.name}(\n${items(e.fields, (f) => `${f.name}: ${exprAt(f.expr, `${f.name}: `, inner)}`)}\n${indent})`;
  if (e.kind === 'ArrayLit' && e.elems.length) return `[\n${items(e.elems, (x) => exprAt(x, '', inner))}\n${indent}]`;
  return flat;
}

export function format(src) {
  const program = parse(src);
  const comments = [...program.comments];
  const out = [];
  let lastLine = 0; // source line of the last thing emitted, for blank-line grouping

  const firstLine = (n) => n.stmtLine ?? n.line;
  // Comments that stand on their own line before `line`.
  function leading(line, indent) {
    while (comments.length && comments[0].line < line) {
      const c = comments.shift();
      if (out.length && c.line - lastLine > 1 && out[out.length - 1] !== '' && !out[out.length - 1].endsWith('{')) out.push('');
      out.push(`${indent}${c.text}`);
      lastLine = c.line;
    }
  }
  // A comment at the end of the line a statement ends on.
  function trailing(line) {
    if (comments.length && comments[0].line === line && !comments[0].own) {
      out[out.length - 1] += `  ${comments.shift().text}`;
    }
  }
  function gap(line) {
    if (out.length && lastLine && line - lastLine > 1 && out[out.length - 1] !== '' && !out[out.length - 1].endsWith('{')) out.push('');
  }

  const simple = (s) => ['Let', 'Assign', 'Return', 'Assert', 'ExprStmt'].includes(s.kind);
  // { stmt } stays on one line when it was written that way.
  const inlineBody = (body, openLine) => body.length === 1 && simple(body[0]) && body.closeLine === openLine
    && !comments.some((c) => c.line === openLine);
  const one = (s) => {
    switch (s.kind) {
      case 'Let': return `${s.mutable ? 'var' : 'let'} ${s.name}${s.ty ? `: ${fmtType(s.ty)}` : ''} = ${expr(s.init)}`;
      case 'Assign': return `${expr(s.target)} = ${expr(s.value)}`;
      case 'Return': return s.value ? `return ${expr(s.value)}` : 'return';
      case 'Assert': return `assert ${expr(s.cond)}`;
      case 'ExprStmt': return expr(s.expr);
      default: throw new Error('unreachable');
    }
  };

  function block(body, indent) {
    for (const s of body) stmt(s, `${indent}  `);
    leading(body.closeLine + 1, `${indent}  `);
    out.push(`${indent}}`);
    lastLine = body.closeLine;
  }
  // head: text before the opening brace
  function braced(head, body, indent, openLine) {
    if (body.length === 0 && !comments.some((c) => c.line >= openLine && c.line <= body.closeLine)) {
      out.push(`${indent}${head} { }`);
      lastLine = body.closeLine;
    } else if (inlineBody(body, openLine)) {
      out.push(`${indent}${head} { ${one(body[0])} }`);
      lastLine = body.closeLine;
    } else {
      out.push(`${indent}${head} {`);
      lastLine = openLine;
      block(body, indent);
    }
  }

  function ifStmt(s, indent, lead) {
    braced(`${lead}if ${expr(s.cond)}`, s.then, indent, s.line);
    if (!s.els) return;
    const closing = out.pop();
    if (s.els.length === 1 && s.els[0].kind === 'If' && s.els.closeLine === undefined) {
      ifStmt(s.els[0], indent, `${closing.trimStart()} else `);
    } else {
      braced(`${closing.trimStart()} else`, s.els, indent, s.then.closeLine);
    }
  }

  function stmt(s, indent) {
    leading(firstLine(s), indent);
    gap(firstLine(s));
    switch (s.kind) {
      case 'Let': {
        const head = `${s.mutable ? 'var' : 'let'} ${s.name}${s.ty ? `: ${fmtType(s.ty)}` : ''} = `;
        out.push(`${indent}${head}${exprAt(s.init, head, indent)}`);
        break;
      }
      case 'Assign': {
        const head = `${expr(s.target)} = `;
        out.push(`${indent}${head}${exprAt(s.value, head, indent)}`);
        break;
      }
      case 'Return': out.push(`${indent}${s.value ? `return ${exprAt(s.value, 'return ', indent)}` : 'return'}`); break;
      case 'Assert': out.push(`${indent}assert ${expr(s.cond)}`); break;
      case 'ExprStmt': out.push(`${indent}${exprAt(s.expr, '', indent)}`); break;
      case 'If': ifStmt(s, indent, ''); break;
      case 'While':
        if (s.invariants.length) {
          out.push(`${indent}while ${expr(s.cond)}`, ...s.invariants.map((c) => `${indent}  invariant ${expr(c.expr)}`), `${indent}{`);
          lastLine = s.body.length ? firstLine(s.body[0]) - 1 : s.line;
          block(s.body, indent);
        } else {
          braced(`while ${expr(s.cond)}`, s.body, indent, s.line);
        }
        break;
      case 'For': braced(`for ${s.name} in ${expr(s.start)}..${expr(s.end, 5)}`, s.body, indent, s.stmtLine); break;
      case 'Match': {
        out.push(`${indent}match ${expr(s.scrut)} {`);
        lastLine = s.line;
        for (const arm of s.arms) {
          leading(arm.line, `${indent}  `);
          const pat = arm.variant === null ? 'else' : `${arm.variant}${arm.binds.length ? `(${arm.binds.map((b) => b.name).join(', ')})` : ''}`;
          braced(`${pat} =>`, arm.body, `${indent}  `, arm.line);
          trailing(arm.endLine);
        }
        leading(s.endLine + 1, `${indent}  `);
        out.push(`${indent}}`);
        break;
      }
      default: throw new Error(`format: unknown statement ${s.kind}`);
    }
    lastLine = s.endLine;
    trailing(s.endLine);
  }

  const typeParams = (d) => (d.typeParams.length ? `[${d.typeParams.map((p) => (d.typeBounds?.[p] ? `${p}: ${d.typeBounds[p]}` : p)).join(', ')}]` : '');
  const fieldList = (fields) => fields.map((f) => `${f.name}: ${fmtType(f.ty)}`);

  let prev = null;
  for (const d of program.decls) {
    if (prev) {
      // One blank line between declarations; imports written together stay together.
      const tight = prev.kind === 'Import' && d.kind === 'Import' && d.line - prev.endLine <= 1;
      if (!tight && out[out.length - 1] !== '') out.push('');
    }
    const before = out.length;
    leading(d.line, '');
    if (out.length > before && d.line - lastLine > 1) out.push('');
    switch (d.kind) {
      case 'Import': out.push(`import ${quote(d.path)}`); break;
      case 'Struct': {
        const head = `${d.private ? 'private ' : ''}struct ${d.name}${typeParams(d)}`;
        if (d.line === d.endLine) out.push(`${head} { ${fieldList(d.fields).join(', ')} }`);
        else out.push(`${head} {`, ...fieldList(d.fields).map((f) => `  ${f},`), '}');
        break;
      }
      case 'Enum': {
        const head = `${d.private ? 'private ' : ''}enum ${d.name}${typeParams(d)}`;
        const vs = d.variants.map((v) => `${v.name}${v.fields.length ? `(${fieldList(v.fields).join(', ')})` : ''}`);
        if (d.line === d.endLine) out.push(`${head} { ${vs.join(', ')} }`);
        else out.push(`${head} {`, ...vs.map((v) => `  ${v},`), '}');
        break;
      }
      case 'Test':
        out.push(`test ${quote(d.name)} {`);
        lastLine = d.line;
        block(d.body, '');
        break;
      case 'Fn': {
        const params = d.params.map((p) => `${p.name}: ${p.mut ? 'mut ' : ''}${fmtType(p.ty)}`).join(', ');
        let head = `${d.private ? 'private ' : ''}fn ${d.name}${typeParams(d)}(${params})`;
        if (d.ret !== 'Unit') head += ` -> ${fmtType(d.ret)}`;
        if (d.effects.length) head += ` uses ${d.effects.map((e) => e.name).join(', ')}`;
        const contracts = [...d.requires.map((c) => ({ ...c, kw: 'requires' })), ...d.ensures.map((c) => ({ ...c, kw: 'ensures' }))]
          .sort((a, b) => a.line - b.line || a.col - b.col);
        if (contracts.length === 0) {
          if (d.body.length === 0 && !comments.some((c) => c.line >= d.line && c.line <= d.endLine)) { out.push(`${head} { }`); break; }
          out.push(`${head} {`);
        } else {
          out.push(head);
          for (const c of contracts) {
            leading(c.line, '  ');
            out.push(`  ${c.kw} ${expr(c.expr)}`);
            lastLine = c.line;
            trailing(c.line);
          }
          out.push('{');
        }
        lastLine = d.body.length ? firstLine(d.body[0]) - 1 : d.endLine;
        // Comments between the header and the first statement belong at the top of the body.
        block(d.body, '');
        break;
      }
      default: throw new Error(`format: unknown declaration ${d.kind}`);
    }
    lastLine = d.endLine;
    trailing(d.endLine);
    prev = d;
  }
  leading(Infinity, '');
  while (out.length && out[out.length - 1] === '') out.pop();
  return `${out.join('\n')}\n`;
}

// The shape of a program without positions: two sources with the same shape mean the same thing.
export function shape(src) {
  const skip = new Set(['line', 'col', 'endLine', 'stmtLine', 'nameLine', 'nameCol', 'tyLine', 'tyCol', 'text', 'comments', 'decls', 'raw']);
  const program = parse(src);
  return JSON.stringify(program, (k, v) => (skip.has(k) ? undefined : typeof v === 'bigint' ? `${v}n` : v));
}
