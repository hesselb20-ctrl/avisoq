// Running a script that acts on the outside world through tools.
//
//   avisoq plan script.avq                 what it can do, before it runs
//   avisoq approve script.avq              a person agrees to exactly that
//   avisoq act script.avq '[7]' --tools tools.json     run it; every tool call is logged
//   avisoq replay script.avq               rerun the last run against its log, without calling anything
//
// The order of defence: the compiler works out the manifest; approval (by a person, or by a
// policy file) is tied to a hash of the compiled script and its manifest, so any change needs a
// new approval; the runner counts every tool call against the caps in the declarations and
// refuses the call that would go over; and every call, its arguments and its answer are written
// to a log that a replay can check.
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { load, AvisoqError, jsonSafe } from './embed.mjs';
import { showManifest } from './manifest.mjs';
import { mismatch, openTools } from './mcp-client.mjs';

export const DEFAULT_LIMITS = { timeLimitMs: 5000, memoryLimitMb: 256 };

// Compiles a script and returns what is needed to describe, approve and run it.
// tools: { name: function(...args) } that answer the script's tool calls (they may be async).
export async function prepare(path, { source, tools = {}, allow = [], timeLimitMs = DEFAULT_LIMITS.timeLimitMs, memoryLimitMb = DEFAULT_LIMITS.memoryLimitMb, onCall = null } = {}) {
  const run = { counts: new Map(), totals: new Map() };
  const guarded = {};
  let plan = null;
  const wrap = (decl) => async (...args) => {
    // refuse the call that would go over, before anything happens outside
    const n = (run.counts.get(decl.name) ?? 0) + 1;
    const shownArgs = args.map((a) => (typeof a === 'bigint' ? a.toString() : a));
    const limitError = (message) => { onCall?.({ tool: decl.name, args: shownArgs, refused: message }); return Object.assign(new Error(message), { kind: 'limit' }); };
    if (decl.max !== null && n > decl.max) throw limitError(`'${decl.name}' may be called at most ${decl.max} time${decl.max === 1 ? '' : 's'} in one run, and this would be call ${n}`);
    for (const t of decl.totals) {
      const value = BigInt(args[decl.params.findIndex((p) => p.name === t.param)]);
      const key = `${decl.name}.${t.param}`, sum = (run.totals.get(key) ?? 0n) + value;
      if (value < 0n) throw limitError(`'${decl.name}': ${t.param} is added up against a limit, so it cannot be negative (got ${value})`);
      if (sum > BigInt(t.max)) throw limitError(`'${decl.name}': ${t.param} may add up to at most ${t.max} in one run, and this call would bring it to ${sum}`);
      run.totals.set(key, sum);
    }
    run.counts.set(decl.name, n);
    const started = performance.now();
    const shown = args.map((a) => (typeof a === 'bigint' ? a.toString() : a));
    if (typeof tools[decl.name] !== 'function') { const e = Object.assign(new Error(`tool '${decl.name}' is not available here`), { kind: 'capability_denied' }); onCall?.({ tool: decl.name, args: shown, error: e.message, ms: 0 }); throw e; }
    try {
      const result = await tools[decl.name](...args);
      onCall?.({ tool: decl.name, args: shown, result: typeof result === 'bigint' ? result.toString() : result, ms: Math.round(performance.now() - started) });
      return result;
    } catch (e) {
      onCall?.({ tool: decl.name, args: shown, error: e.message, ms: Math.round(performance.now() - started) });
      throw e.kind ? e : Object.assign(new Error(`tool '${decl.name}' failed: ${e.message}`), { kind: 'tool' });
    }
  };
  // Tool declarations are only known after compiling, so the wrappers are looked up by name.
  const host = new Proxy({}, { get: (_, name) => guarded[name], has: (_, name) => name in guarded });
  const module = await load(path, { source, allow, host, waits: true, timeLimitMs, memoryLimitMb });
  plan = module.$plan;
  for (const decl of plan.tools) guarded[decl.name] = wrap(decl);
  return {
    module, plan, hash: module.$hash, limits: { timeLimitMs, memoryLimitMb },
    reset: () => { run.counts.clear(); run.totals.clear(); },
  };
}

// The one function to start: the one named, or the only one there is.
export function entryOf(plan, name, how = 'with --fn') {
  // without a name: the one function that no other function of the script calls
  const roots = plan.entries.filter((e) => e.root);
  const entries = roots.length ? roots : plan.entries;
  if (name) {
    if (!plan.entries.some((e) => e.name === name)) throw new AvisoqError(`there is no function '${name}' to start (there ${plan.entries.length === 1 ? 'is' : 'are'}: ${plan.entries.map((e) => e.name).join(', ') || 'none'})`, { kind: 'argument' });
    return name;
  }
  if (entries.length !== 1) throw new AvisoqError(`say which function to start ${how} (there are: ${entries.map((e) => e.name).join(', ') || 'none'})`, { kind: 'argument' });
  return entries[0].name;
}

// ---- approval: by a person (a file next to the script) or by a policy ----
// An approval can be signed. `avisoq keygen` makes a key pair: the private key stays in the
// approver's home folder, the public key goes into an approvers file. When an approvers file is
// in use, only approvals signed by someone listed in it count, so whoever can write files next
// to the script (an agent, for instance) cannot approve its own work.
const approvalFile = (path) => `${path}.approval.json`;
const signedText = (hash, entry, by, at) => `avisoq approval\n${hash}\n${entry}\n${by}\n${at}\n`;
export const defaultKeyFile = (name) => join(process.env.AVISOQ_HOME ?? join(homedir(), '.avisoq'), 'keys', `${name}.key`);
export const whoAmI = () => (process.env.AVISOQ_APPROVER ?? process.env.USERNAME ?? process.env.USER ?? 'someone').toLowerCase().replace(/[^a-z0-9_.-]+/g, '_');

export function keygen(name, approversFile) {
  const keyFile = defaultKeyFile(name);
  if (existsSync(keyFile)) throw new AvisoqError(`${keyFile} already exists; remove it first if you really want a new key for '${name}'`, { kind: 'setup' });
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  mkdirSync(dirname(keyFile), { recursive: true });
  writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const list = existsSync(approversFile) ? JSON.parse(readFileSync(approversFile, 'utf8')) : { approvers: {} };
  list.approvers[name] = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  writeFileSync(approversFile, `${JSON.stringify(list, null, 1)}\n`);
  return keyFile;
}

export const readApprovers = (file) => (file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).approvers ?? {} : null);

export function approve(path, prepared, entry, { by = whoAmI(), keyFile = defaultKeyFile(by), notes = {} } = {}) {
  const text = showManifest(prepared.plan, entry, { file: basename(path), hash: prepared.hash, limits: prepared.limits, notes });
  const all = existsSync(approvalFile(path)) ? JSON.parse(readFileSync(approvalFile(path), 'utf8')) : {};
  const kept = all.hash === prepared.hash ? all.entries ?? {} : {};
  const at = new Date().toISOString();
  kept[entry] = { by, at, manifest: text };
  if (existsSync(keyFile)) kept[entry].signature = sign(null, Buffer.from(signedText(prepared.hash, entry, by, at)), createPrivateKey(readFileSync(keyFile))).toString('base64');
  writeFileSync(approvalFile(path), `${JSON.stringify({ hash: prepared.hash, entries: kept }, null, 1)}\n`);
  return { text, signed: !!kept[entry].signature };
}

// Who approved this exact script, or null. With `approvers` (name -> public key), only a valid
// signature by one of them counts; `why` then says what was wrong with the approval on file.
export function approvedBy(path, prepared, entry, approvers = null, why = {}) {
  if (!existsSync(approvalFile(path))) return null;
  try {
    const a = JSON.parse(readFileSync(approvalFile(path), 'utf8'));
    const e = a.hash === prepared.hash ? a.entries?.[entry] : null;
    if (!e) { if (a.hash !== prepared.hash) why.reason = 'the script or its limits changed after it was approved'; return null; }
    if (approvers) {
      if (!e.signature) { why.reason = 'its approval is not signed, and this setup only accepts signed approvals'; return null; }
      if (!approvers[e.by]) { why.reason = `'${e.by}' is not in the approvers file`; return null; }
      const key = createPublicKey({ key: Buffer.from(approvers[e.by], 'base64'), format: 'der', type: 'spki' });
      if (!verify(null, Buffer.from(signedText(a.hash, entry, e.by, e.at)), key, Buffer.from(e.signature, 'base64'))) { why.reason = `the signature on its approval is not ${e.by}'s`; return null; }
      return `approved and signed by ${e.by} on ${e.at.slice(0, 10)}`;
    }
    return `approved by ${e.by} on ${e.at.slice(0, 10)}`;
  } catch { why.reason = 'its approval file cannot be read'; return null; }
}

// A policy says what may run without asking a person:
//   { "tools": { "lookup_order": {}, "refund": { "max": 1, "totals": { "amount_cents": 2000 } } }, "effects": [] }
// A script passes if every tool it can reach is listed, is bounded at least as tightly as the
// policy asks, and it uses no other capability than the policy lists. Returns null, or why not.
export function policyProblem(policy, plan, entryName) {
  const entry = plan.entries.find((e) => e.name === entryName);
  const allowed = policy.tools ?? {};
  const problems = [];
  for (const t of entry.tools) {
    const rule = allowed[t.real];
    if (!rule) { problems.push(`the policy does not allow the tool '${t.real}'`); continue; }
    if (rule.max !== undefined && (t.bound === 'unlimited' || t.calls > rule.max)) problems.push(`the policy allows '${t.name}' at most ${rule.max} time${rule.max === 1 ? '' : 's'} per run, and this script ${t.bound === 'unlimited' ? 'has no limit on it' : `allows ${t.calls}`}`);
    for (const [param, most] of Object.entries(rule.totals ?? {})) {
      const declared = t.totals.find((x) => x.param === param);
      if (!declared || declared.max > most) problems.push(`the policy limits ${param} of '${t.name}' to a total of ${most}, and this script ${declared ? `allows ${declared.max}` : 'sets no total'}`);
    }
  }
  for (const e of entry.effects.filter((x) => !(policy.effects ?? []).includes(x))) problems.push(`the policy does not allow the capability '${e}'${e === 'io' ? ' (printing): return the result from the function instead' : ''}`);
  return problems.length ? problems.join('; ') : null;
}

// A policy in words, for whoever writes scripts under it.
export function showPolicy(policy) {
  const lines = Object.entries(policy.tools ?? {}).map(([name, rule]) => {
    const parts = [];
    if (rule.max !== undefined) parts.push(`at most ${rule.max} call${rule.max === 1 ? '' : 's'} per run (declare: at most ${rule.max})`);
    for (const [param, most] of Object.entries(rule.totals ?? {})) parts.push(`${param} adding up to at most ${most} per run (declare: total ${param} at most ${most})`);
    return `  ${name}: ${parts.length ? parts.join(', ') : 'any number of calls'}`;
  });
  const effects = policy.effects ?? [];
  return `A script runs without asking a person when it uses only these tools, within these bounds:
${lines.join('\n') || '  (none)'}
${effects.length ? `It may also use: ${effects.join(', ')}.` : 'It may use nothing else: no printing, files or network.'}
Anything beyond that is not run until a person approves it.`;
}

// A script that arrives from an agent may import the standard library and nothing else: a file
// path in an import would make the compiler read that file. Returns the first such import, or null.
export function importOutside(source) {
  const m = /^[ \t]*import[ \t]+"(?!std\/[a-z_]+")([^"]*)"/m.exec(source);
  return m ? m[1] : null;
}

// ---- running, with a log ----
// Returns { ok, result | error, calls }. log: a file that gets one JSON line per event.
export async function act(path, args, { source, entry, tools = {}, allow = [], limits = {}, log = null } = {}) {
  const calls = [];
  const write = (o) => { if (log) appendFileSync(log, `${JSON.stringify(o)}\n`); };
  const prepared = await prepare(path, { source, tools, allow, ...DEFAULT_LIMITS, ...limits, onCall: (c) => { calls.push(c); write({ event: c.refused ? 'refused' : 'call', n: calls.length, ...c }); } });
  const name = entryOf(prepared.plan, entry);
  write({ event: 'start', script: basename(path), hash: prepared.hash, entry: name, args: jsonSafe(args), at: new Date().toISOString() });
  try {
    const result = jsonSafe(await prepared.module[name](...args));
    write({ event: 'end', ok: true, result: result ?? null, calls: calls.length });
    return { ok: true, result, calls, hash: prepared.hash, entry: name };
  } catch (e) {
    const error = { kind: e.kind ?? 'error', message: e.message };
    write({ event: 'end', ok: false, error, calls: calls.length });
    return { ok: false, error, calls, hash: prepared.hash, entry: name };
  }
}

// Binds a script's tool declarations to the tools of running MCP servers, after checking
// that each declaration fits what the server offers.
export function bindTools(plan, offered) {
  const tools = {}, notes = {};
  for (const decl of plan.tools) {
    const t = offered.get(decl.real);
    if (!t) throw new AvisoqError(`the script declares the tool '${decl.real}', which no server in the tools file offers (they offer: ${[...offered.keys()].join(', ') || 'nothing'})`, { kind: 'setup' });
    const wrong = mismatch(decl, t);
    if (wrong) throw new AvisoqError(`the declaration of tool '${decl.name}' does not fit the server '${t.server}': ${wrong}`, { kind: 'setup' });
    notes[decl.name] = `[${t.server}${t.annotations.readOnlyHint ? ', only reads' : t.annotations.destructiveHint ? ', can destroy' : ''}]`;
    // the type the script gets when the call works: T, or the T of Result[T, Str]
    const want = decl.ret.startsWith('Result[') ? decl.ret.slice(7, decl.ret.lastIndexOf(',')) : decl.ret;
    tools[decl.name] = async (...args) => {
      const text = await t.call(Object.fromEntries(decl.params.map((p, i) => [p.name, jsonSafe(typeof args[i] === 'bigint' ? Number(args[i]) : args[i])])));
      if (want === 'Str') return text;
      if (want === 'Unit') return undefined;
      // anything else is read from JSON: a number, a boolean, a list, or an object for a struct
      let v;
      try { v = JSON.parse(text); } catch { throw Object.assign(new Error(`tool '${decl.name}' answered ${JSON.stringify(text.slice(0, 80))}, which is not JSON for ${want}`), { kind: 'tool' }); }
      return v;
    };
  }
  return { tools, notes };
}

// ---- replay: the same script against the answers in a log ----
export function lastRun(logFile) {
  const events = readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const start = events.map((e) => e.event).lastIndexOf('start');
  if (start < 0) throw new AvisoqError(`${logFile} holds no run`, { kind: 'setup' });
  const rest = events.slice(start + 1);
  return { start: events[start], calls: rest.filter((e) => e.event === 'call'), end: rest.find((e) => e.event === 'end') };
}

export async function replay(path, logFile, { source, allow = [], limits = {} } = {}) {
  const run = lastRun(logFile);
  let n = 0;
  const differences = [];
  const answer = (name) => (...args) => {
    const was = run.calls[n++];
    const now = { tool: name, args: args.map((a) => (typeof a === 'bigint' ? a.toString() : a)) };
    if (!was) { differences.push(`call ${n}: ${name}(${JSON.stringify(now.args).slice(1, -1)}) was not made in the logged run`); throw Object.assign(new Error('the logged run made no such call'), { kind: 'replay' }); }
    if (was.tool !== name || JSON.stringify(was.args) !== JSON.stringify(now.args)) differences.push(`call ${n}: the log has ${was.tool}(${JSON.stringify(was.args).slice(1, -1)}), now ${name}(${JSON.stringify(now.args).slice(1, -1)})`);
    if (was.error !== undefined) throw Object.assign(new Error(was.error), { kind: 'tool' });
    return was.result;
  };
  const tools = new Proxy({}, { get: (_, name) => answer(name) });
  const r = await act(path, run.start.args, { source, entry: run.start.entry, tools, allow, limits });
  if (r.hash !== run.start.hash) differences.unshift('the script is not the one that was logged (it has changed since)');
  if (n < run.calls.length) differences.push(`the logged run made ${run.calls.length} calls, now ${n}`);
  if (run.end && (run.end.ok !== r.ok || JSON.stringify(run.end.ok ? run.end.result : run.end.error.kind) !== JSON.stringify(r.ok ? r.result ?? null : r.error.kind))) differences.push(`the logged run ended with ${JSON.stringify(run.end.ok ? run.end.result : run.end.error)}, now ${JSON.stringify(r.ok ? r.result ?? null : r.error)}`);
  return { same: differences.length === 0, differences, calls: run.calls.length, result: r };
}

export { openTools, showManifest };
