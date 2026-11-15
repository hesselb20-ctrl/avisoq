// A small Model Context Protocol client: starts servers and calls their tools.
//
// A tools file names the servers a script's tools come from:
//
//   { "servers": { "shop": { "command": "node", "args": ["shop-server.mjs"] } } }
//
// Paths in it are relative to the file. Only what scripts need is implemented: initialize,
// tools/list and tools/call over stdio.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class ToolError extends Error {
  constructor(message, kind = 'tool') { super(message); this.kind = kind; }
}

function connect(name, spec, cwd) {
  const child = spawn(spec.command, spec.args ?? [], { cwd, env: { ...process.env, ...(spec.env ?? {}) }, stdio: ['pipe', 'pipe', 'inherit'], shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(spec.command) });
  const waiting = new Map();
  let buffer = '', next = 0, dead = null;
  const fail = (why) => { dead = why; for (const w of waiting.values()) w.reject(new ToolError(why, 'tool_server')); waiting.clear(); };
  child.on('error', (e) => fail(`tool server '${name}' could not be started: ${e.message}`));
  child.on('exit', (code) => fail(`tool server '${name}' stopped (exit ${code})`));
  child.stdout.on('data', (d) => {
    buffer += d;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const w = waiting.get(msg.id);
      if (!w) continue;
      waiting.delete(msg.id);
      if (msg.error) w.reject(new ToolError(`tool server '${name}': ${msg.error.message}`, 'tool_server')); else w.resolve(msg.result);
    }
  });
  const request = (method, params, timeoutMs = 60000) => new Promise((ok, reject) => {
    if (dead) { reject(new ToolError(dead, 'tool_server')); return; }
    const id = ++next;
    const timer = setTimeout(() => { waiting.delete(id); reject(new ToolError(`tool server '${name}' did not answer ${method} within ${timeoutMs} ms`, 'tool_server')); }, timeoutMs);
    waiting.set(id, { resolve: (v) => { clearTimeout(timer); ok(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  const notify = (method) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  return { name, request, notify, close: () => { try { child.stdin.end(); child.kill(); } catch { /* already gone */ } } };
}

// Starts every server in the tools file and lists their tools.
// Returns { tools: Map name -> { server, name, description, inputSchema, annotations, call(argsObject) }, close }.
export async function openTools(toolsFile) {
  const config = JSON.parse(readFileSync(toolsFile, 'utf8'));
  const cwd = dirname(resolve(toolsFile));
  const servers = [], tools = new Map();
  try {
    for (const [name, spec] of Object.entries(config.servers ?? config.mcpServers ?? {})) {
      const s = connect(name, spec, cwd);
      servers.push(s);
      await s.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'avisoq', version: '1' } }, 20000);
      s.notify('notifications/initialized');
      const listed = await s.request('tools/list', {}, 20000);
      for (const t of listed.tools ?? []) {
        if (tools.has(t.name)) throw new ToolError(`tool '${t.name}' is offered by both '${tools.get(t.name).server}' and '${name}'`, 'setup');
        tools.set(t.name, {
          server: name, name: t.name, description: t.description ?? '', inputSchema: t.inputSchema ?? { type: 'object', properties: {} }, annotations: t.annotations ?? {},
          call: async (args) => {
            const r = await s.request('tools/call', { name: t.name, arguments: args });
            const text = (r.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
            if (r.isError) throw new ToolError(`tool '${t.name}' reported an error: ${text || 'no details'}`);
            return text;
          },
        });
      }
    }
  } catch (e) {
    for (const s of servers) s.close();
    throw e;
  }
  return { tools, close: () => { for (const s of servers) s.close(); } };
}

const JSON_TO_AVISOQ = { integer: 'Int', number: 'Float', boolean: 'Bool', string: 'Str' };

// The Avisoq declaration for a tool, or a comment saying why it cannot be declared.
export function declarationOf(t) {
  const props = Object.entries(t.inputSchema.properties ?? {});
  const odd = props.filter(([, s]) => !JSON_TO_AVISOQ[s.type]);
  const said = t.description ? `// ${t.description.replace(/\s+/g, ' ').trim()}\n` : '';
  if (odd.length) return `${said}// (not usable from a script yet: ${odd.map(([n, s]) => `${n} is ${s.type ?? 'an unknown type'}`).join(', ')})\n// tool ${t.name}(...)`;
  const kind = t.annotations.readOnlyHint ? '   // only reads' : t.annotations.destructiveHint ? '   // changes or deletes things' : '';
  return `${said}tool ${t.name}(${props.map(([n, s]) => `${n}: ${JSON_TO_AVISOQ[s.type]}`).join(', ')}) -> Str${kind}`;
}

// Does the script's declaration of a tool fit what the server offers? Returns a problem, or null.
export function mismatch(declared, offered) {
  const props = offered.inputSchema.properties ?? {};
  const fits = { Int: ['integer', 'number'], Float: ['number'], Bool: ['boolean'], Str: ['string'] };
  for (const p of declared.params) {
    if (!props[p.name]) return `the tool has no argument '${p.name}' (it takes ${Object.keys(props).join(', ') || 'none'})`;
    if (!fits[p.ty] || !fits[p.ty].includes(props[p.name].type)) return `argument '${p.name}' is declared ${p.ty} but the tool takes ${props[p.name].type ?? 'another type'}`;
  }
  const missing = (offered.inputSchema.required ?? []).filter((r) => !declared.params.some((p) => p.name === r));
  if (missing.length) return `the tool also needs ${missing.join(', ')}`;
  return null;
}
