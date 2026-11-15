// `avisoq mcp file.avq`: every function of a file as a tool an AI agent can call.
//
// Speaks the Model Context Protocol over stdin/stdout (JSON-RPC 2.0, one message per line), so
// any MCP client can use it:
//
//   { "mcpServers": { "pricing": { "command": "avisoq", "args": ["mcp", "pricing.avq"] } } }
//
// Each callable function becomes one tool. Its input schema comes from the parameter types, its
// description from the comment above it, and the description states which capabilities the
// function uses, so the person approving the tool can see what it is able to do. Calls run in
// the WebAssembly sandbox (or as native code with --native) with a time and memory limit:
// 5 seconds and 256 MB unless --time-limit and --memory say otherwise.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { load, jsonSafe } from './embed.mjs';
import { elemOf, isArr, showType, typeHead } from './types.mjs';

const PROTOCOL = '2025-06-18';
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// The JSON Schema of a value of an Avisoq type, as it crosses the boundary (see src/embed.mjs).
export function schemaOf(ty, types) {
  if (ty === 'Int') return { type: 'integer' };
  if (ty === 'Float') return { type: 'number' };
  if (ty === 'Bool') return { type: 'boolean' };
  if (ty === 'Str') return { type: 'string' };
  if (isArr(ty)) return { type: 'array', items: schemaOf(elemOf(ty), types) };
  const st = types.structs[ty];
  if (st) {
    if (/^Tuple[2-4]$/.test(typeHead(ty))) return { type: 'array', prefixItems: st.map((f) => schemaOf(f.ty, types)), minItems: st.length, maxItems: st.length };
    return { type: 'object', properties: Object.fromEntries(st.map((f) => [f.name, schemaOf(f.ty, types)])), required: st.map((f) => f.name), additionalProperties: false };
  }
  const en = types.enums[ty];
  if (en) {
    return { oneOf: en.map((v) => ({ type: 'object', properties: { variant: { const: v.name }, ...Object.fromEntries(v.fields.map((f) => [f.name, schemaOf(f.ty, types)])) }, required: ['variant', ...v.fields.map((f) => f.name)], additionalProperties: false })) };
  }
  return {};
}

// The comment lines directly above `fn name(` in the source, joined.
function commentAbove(source, name) {
  const lines = source.replace(/\r/g, '').split('\n');
  const at = lines.findIndex((l) => new RegExp(`^\\s*fn\\s+${name}\\s*[\\[(]`).test(l));
  const out = [];
  for (let i = at - 1; i >= 0 && /^\s*\/\//.test(lines[i]); i--) out.unshift(lines[i].replace(/^\s*\/\/\s?/, ''));
  return out.join(' ').trim();
}

export function toolsOf(module, types, source) {
  return module.$functions.map((f) => {
    const signature = `${f.name}(${f.params.map((p) => `${p.name}: ${showType(p.ty)}`).join(', ')})${f.ret === 'Unit' ? '' : ` -> ${showType(f.ret)}`}`;
    const can = f.effects.length ? `Capabilities it uses: ${f.effects.join(', ')}.` : 'It uses no capabilities: it cannot print, read or write files, use the network or start programs.';
    const said = commentAbove(source, f.name);
    return {
      name: f.name,
      description: `${said ? `${said}${/[.!?]$/.test(said) ? '' : '.'} ` : ''}Avisoq function ${signature}. ${can}`,
      inputSchema: { type: 'object', properties: Object.fromEntries(f.params.map((p) => [p.name, schemaOf(p.ty, types)])), required: f.params.map((p) => p.name), additionalProperties: false },
    };
  });
}

export async function mcp(path, { allow = [], native = false, timeLimitMs = 0, memoryLimitMb = 0, host } = {}) {
  const say = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
  const limits = { timeLimitMs: timeLimitMs || 5000, memoryLimitMb: memoryLimitMb || 256 };
  let module = null, problem = null, tools = [];
  try {
    module = await load(path, { allow, native, host, ...limits });
    tools = toolsOf(module, module.$types, readFileSync(path, 'utf8'));
  } catch (e) {
    problem = e.message; // reported when the client lists or calls tools, so it sees why
  }
  for await (const line of createInterface({ input: process.stdin })) {
    if (!line.trim()) continue;
    let req;
    try { req = JSON.parse(line); } catch { say({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'not valid JSON' } }); continue; }
    if (req.id === undefined || req.id === null) continue; // a notification: nothing to answer
    const answer = (result) => say({ jsonrpc: '2.0', id: req.id, result });
    const refuse = (code, message) => say({ jsonrpc: '2.0', id: req.id, error: { code, message } });
    if (req.method === 'initialize') {
      answer({ protocolVersion: typeof req.params?.protocolVersion === 'string' ? req.params.protocolVersion : PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: `avisoq:${basename(path)}`, version },
        instructions: `Functions of ${basename(path)}, written in Avisoq. Each call is limited to ${limits.timeLimitMs} ms and ${limits.memoryLimitMb} MB, and can use only the capabilities its description lists.` });
    } else if (req.method === 'ping') {
      answer({});
    } else if (req.method === 'tools/list') {
      if (problem) refuse(-32603, `${basename(path)} does not compile: ${problem}`); else answer({ tools });
    } else if (req.method === 'tools/call') {
      const f = module && module.$functions.find((x) => x.name === req.params?.name);
      if (problem) { answer({ content: [{ type: 'text', text: `${basename(path)} does not compile: ${problem}` }], isError: true }); continue; }
      if (!f) { refuse(-32602, `there is no tool '${req.params?.name}'`); continue; }
      const given = req.params.arguments ?? {};
      const missing = f.params.filter((p) => !(p.name in given)).map((p) => p.name);
      const extra = Object.keys(given).filter((k) => !f.params.some((p) => p.name === k));
      if (missing.length || extra.length) {
        answer({ content: [{ type: 'text', text: `argument: ${f.name} takes ${f.params.map((p) => `${p.name}: ${showType(p.ty)}`).join(', ') || 'no arguments'}${missing.length ? `; missing ${missing.join(', ')}` : ''}${extra.length ? `; not a parameter: ${extra.join(', ')}` : ''}` }], isError: true });
        continue;
      }
      try {
        const result = module[f.name](...f.params.map((p) => given[p.name]));
        const printed = module.$output();
        const value = result === undefined ? null : jsonSafe(result);
        // in the text, an Int too large for a JSON number is still written as a number
        const shown = result === undefined ? '' : JSON.stringify(result, (k, x) => (typeof x === 'bigint' ? `@int:${x}` : x)).replace(/"@int:(-?\d+)"/g, '$1');
        answer({ content: [{ type: 'text', text: `${printed}${result === undefined ? (printed ? '' : 'done') : shown}` }], ...(result !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value) ? { structuredContent: value } : {}), isError: false });
      } catch (e) {
        const printed = module.$output();
        answer({ content: [{ type: 'text', text: `${printed}${e.kind ?? 'error'}: ${e.message}` }], isError: true });
      }
    } else {
      refuse(-32601, `method '${req.method}' is not supported`);
    }
  }
  return 0;
}
