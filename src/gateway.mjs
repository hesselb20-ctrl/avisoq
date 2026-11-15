// `avisoq gateway --tools tools.json --policy policy.json`: how an AI agent uses all this.
//
// The agent no longer gets the real tools. It gets this MCP server, with four tools of its own:
//
//   avisoq_guide    the language, on one page
//   avisoq_tools    the declarations of the tools a script may use
//   avisoq_check    compile a script and see exactly what it could do
//   avisoq_run      run a script: at once if the policy covers it, otherwise only after a person
//                   has approved it (the answer says what to show them)
//
// So instead of one tool call at a time, each needing a yes, the agent writes one script; what
// that script can do is known before it runs, and that is what gets approved.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { act, approvedBy, bindTools, entryOf, policyProblem, prepare, showManifest } from './act.mjs';
import { declarationOf, openTools } from './mcp-client.mjs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const GUIDE = () => readFileSync(new URL('../docs/AGENT_GUIDE.md', import.meta.url), 'utf8');

const HOW = `Write one Avisoq script that does the whole job, instead of calling tools one by one.
1. avisoq_tools lists the tools a script may use; copy the declarations you need to the top of the script.
   Add limits to the ones that change things:   at most 1   /   total amount_cents at most 2000   /   requires amount_cents > 0
   Tight limits are what lets a script run without asking a person.
2. A function that calls tools says "uses tools". Tools answer with text, usually JSON: import "std/json".
3. avisoq_check shows what the script could do. avisoq_run runs it.
avisoq_guide explains the language.`;

export async function gateway({ toolsFile, policyFile, dir, limits, allow = [] }) {
  const say = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
  let servers = null, problem = null;
  try {
    if (!toolsFile) throw new Error('name the tools file with --tools <file>');
    servers = await openTools(toolsFile);
  } catch (e) { problem = e.message; }
  const policy = () => (policyFile ? JSON.parse(readFileSync(policyFile, 'utf8')) : null);
  mkdirSync(dir, { recursive: true });

  const safeName = (name) => (String(name ?? 'script').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'script');
  // Compiles a submitted script against the real tools. Returns what is needed to describe or run it.
  async function look(args) {
    const source = String(args.script ?? '');
    const scratch = join(dir, `${safeName(args.name)}.draft.avq`);
    const prepared = await prepare(scratch, { source, allow, ...limits });
    const entry = entryOf(prepared.plan, args.function);
    const { tools, notes } = bindTools(prepared.plan, servers.tools);
    const file = join(dir, `${safeName(args.name)}-${prepared.hash.slice(0, 12)}.avq`);
    const text = showManifest(prepared.plan, entry, { file: basename(file), hash: prepared.hash, limits, notes });
    const pol = policy();
    const notCovered = pol ? policyProblem(pol, prepared.plan, entry) : 'there is no policy, so every script needs a person to approve it';
    return { source, prepared, entry, tools, file, text, notCovered };
  }

  const TOOLS = [
    { name: 'avisoq_guide', description: 'How to write an Avisoq script: the language on one page. Read this once before writing a script.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'avisoq_tools', description: `The tools a script may use, as declarations to copy into it. ${HOW}`, inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'avisoq_check', description: 'Compiles a script without running it. Returns the compiler errors with their fixes, or exactly what the script could do (which tools, how often, under which rules) and whether it may run without asking a person.',
      inputSchema: { type: 'object', properties: { script: { type: 'string', description: 'The whole Avisoq script.' }, name: { type: 'string', description: 'A short name for it.' }, function: { type: 'string', description: 'The function to start, if the script has more than one.' } }, required: ['script'], additionalProperties: false } },
    { name: 'avisoq_run', description: 'Runs a script. It runs at once when the policy covers what it can do; otherwise nothing runs and the answer contains what a person has to approve first. Returns the result and every tool call that was made.',
      inputSchema: { type: 'object', properties: { script: { type: 'string', description: 'The whole Avisoq script.' }, name: { type: 'string', description: 'A short name for it.' }, function: { type: 'string', description: 'The function to start, if the script has more than one.' }, arguments: { type: 'array', description: 'The arguments of that function, in order.' } }, required: ['script'], additionalProperties: false } },
  ];
  const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], isError });

  async function call(name, args) {
    if (problem) return text(`The gateway could not start its tools: ${problem}`, true);
    if (name === 'avisoq_guide') return text(`${GUIDE()}\n\n## Scripts that use tools\n\n${HOW}\n\nExample:\n\ntool lookup_order(order: Int) -> Str\ntool refund(order: Int, amount_cents: Int) -> Str\n  at most 1\n  total amount_cents at most 2000\n  requires amount_cents > 0\n\nfn handle(order: Int) -> Str uses tools {\n  let receipt = refund(order, 499)\n  return receipt\n}\n`);
    if (name === 'avisoq_tools') return text(`${[...servers.tools.values()].map(declarationOf).join('\n\n')}\n\n${HOW}`);
    if (name !== 'avisoq_check' && name !== 'avisoq_run') return null;
    let seen;
    try { seen = await look(args); } catch (e) {
      const d = e.diagnostics;
      return text(d ? `The script does not compile:\n${d.slice(0, 8).map((x) => `line ${x.line}: error[${x.code}] ${x.message}${x.hint ? `\n  fix: ${x.hint}` : ''}`).join('\n')}` : `The script cannot be used: ${e.message}`, true);
    }
    const approved = approvedBy(seen.file, seen.prepared, seen.entry);
    if (name === 'avisoq_check') {
      return text(`${seen.text}\n\n${approved ? `It may run: ${approved}.` : seen.notCovered ? `It needs a person's approval before it can run: ${seen.notCovered}.` : 'It may run without asking: the policy covers it.'}`);
    }
    if (!approved && seen.notCovered) {
      writeFileSync(seen.file, seen.source);
      return text(`Nothing was run. This script needs a person's approval: ${seen.notCovered}.\n\nShow them this, and ask them to approve it:\n\n${seen.text}\n\nThey approve it with:\n  avisoq approve "${resolve(seen.file)}" --tools "${resolve(toolsFile)}"\n\nThen call avisoq_run again with exactly the same script. If the script can be written with tighter limits, the policy may cover it and no approval is needed.`, true);
    }
    writeFileSync(seen.file, seen.source);
    if (args.arguments !== undefined && !Array.isArray(args.arguments)) return text('arguments must be a list, in the order of the function\'s parameters', true);
    const r = await act(seen.file, args.arguments ?? [], { entry: seen.entry, tools: seen.tools, allow, limits, log: `${seen.file}.runs.jsonl` });
    const made = r.calls.map((c) => `  ${c.tool}(${JSON.stringify(c.args).slice(1, -1)}) ${c.refused ? `REFUSED: ${c.refused}` : c.error !== undefined ? `failed: ${c.error}` : `-> ${JSON.stringify(c.result).slice(0, 300)}`}`).join('\n');
    const head = r.ok ? `Result: ${r.result === undefined ? 'done' : typeof r.result === 'string' ? r.result : JSON.stringify(r.result)}` : `The script stopped [${r.error.kind}]: ${r.error.message}`;
    return text(`${head}\n\nTool calls made (${r.calls.filter((c) => !c.refused).length}):\n${made || '  none'}\n\n(${approved ?? 'allowed by the policy'}; log: ${basename(seen.file)}.runs.jsonl)`, !r.ok);
  }

  for await (const line of createInterface({ input: process.stdin })) {
    if (!line.trim()) continue;
    let req;
    try { req = JSON.parse(line); } catch { say({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'not valid JSON' } }); continue; }
    if (req.id === undefined || req.id === null) continue;
    const answer = (result) => say({ jsonrpc: '2.0', id: req.id, result });
    if (req.method === 'initialize') answer({ protocolVersion: typeof req.params?.protocolVersion === 'string' ? req.params.protocolVersion : '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'avisoq-gateway', version }, instructions: HOW });
    else if (req.method === 'ping') answer({});
    else if (req.method === 'tools/list') answer({ tools: TOOLS });
    else if (req.method === 'tools/call') {
      let result;
      try { result = await call(req.params?.name, req.params?.arguments ?? {}); } catch (e) { result = text(`${e.kind ?? 'error'}: ${e.message}`, true); }
      if (result) answer(result); else say({ jsonrpc: '2.0', id: req.id, error: { code: -32602, message: `there is no tool '${req.params?.name}'` } });
    } else say({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `method '${req.method}' is not supported` } });
  }
  if (servers) servers.close();
  return 0;
}
