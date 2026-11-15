// The commands for scripts that act through tools: plan, approve, act, replay, tools, gateway.
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { act, approve, approvedBy, bindTools, DEFAULT_LIMITS, entryOf, policyProblem, prepare, replay, showManifest } from './act.mjs';
import { declarationOf, openTools } from './mcp-client.mjs';

const out = (s) => process.stdout.write(`${s}\n`);
const err = (s) => process.stderr.write(`${s}\n`);

export async function runCommand(cmd, rest, flags) {
  const limits = { timeLimitMs: flags.timeLimit || DEFAULT_LIMITS.timeLimitMs, memoryLimitMb: flags.memory || DEFAULT_LIMITS.memoryLimitMb };
  let servers = null;
  try {
    if (cmd === 'gateway') {
      const { gateway } = await import('./gateway.mjs');
      return await gateway({ toolsFile: flags.tools, policyFile: flags.policy, dir: flags.dir ?? 'avisoq-scripts', limits, allow: flags.allow });
    }
    if (cmd === 'tools') {
      if (!flags.tools) { err('avisoq tools: name the tools file with --tools <file>'); return 64; }
      servers = await openTools(flags.tools);
      const lines = [...servers.tools.values()].map(declarationOf);
      if (flags.json) out(JSON.stringify([...servers.tools.values()].map((t) => ({ server: t.server, name: t.name, description: t.description, declaration: declarationOf(t) })), null, 2));
      else out(lines.join('\n\n'));
      return 0;
    }
    const [file, argsText] = rest;
    if (!file || !existsSync(file)) { err(`avisoq ${cmd}: ${file ? `cannot read ${file}` : 'which script?'}`); return 66; }
    const log = flags.log ?? `${file}.runs.jsonl`;

    if (cmd === 'replay') {
      if (!existsSync(log)) { err(`avisoq replay: there is no log at ${log}`); return 66; }
      const r = await replay(file, log, { allow: flags.allow, limits });
      if (flags.json) out(JSON.stringify(r, null, 2));
      else out(r.same ? `same: ${r.calls} tool call${r.calls === 1 ? '' : 's'} and the same ending as the logged run` : `different from the logged run:\n${r.differences.map((d) => `  ${d}`).join('\n')}`);
      return r.same ? 0 : 1;
    }

    const prepared = await prepare(file, { allow: flags.allow, ...limits });
    const entry = entryOf(prepared.plan, flags.fn);
    let notes = {}, tools = {};
    if (flags.tools) {
      servers = await openTools(flags.tools);
      ({ tools, notes } = bindTools(prepared.plan, servers.tools));
    }
    const text = showManifest(prepared.plan, entry, { file: basename(file), hash: prepared.hash, limits, notes });

    if (cmd === 'plan') {
      if (flags.json) out(JSON.stringify({ hash: prepared.hash, entry, limits, approved: approvedBy(file, prepared, entry), ...prepared.plan.entries.find((e) => e.name === entry) }, null, 2));
      else out(`${text}\n\n${approvedBy(file, prepared, entry) ?? 'Not approved yet: avisoq approve ' + file}`);
      return 0;
    }
    if (cmd === 'approve') {
      approve(file, prepared, entry);
      out(`${text}\n\nApproved. Any change to the script or to what it can do needs a new approval.`);
      return 0;
    }
    // act
    let why = approvedBy(file, prepared, entry);
    if (!why && flags.policy) {
      const problem = policyProblem(JSON.parse(readFileSync(flags.policy, 'utf8')), prepared.plan, entry);
      if (!problem) why = `allowed by the policy ${basename(flags.policy)}`;
      else err(`The policy does not cover this script: ${problem}.`);
    }
    if (!why) {
      err(`${text}\n\nThis script has not been approved, so nothing was run.\nIf you agree to the above: avisoq approve ${file}`);
      return 77;
    }
    let args;
    try { args = JSON.parse(argsText ?? '[]'); if (!Array.isArray(args)) throw new Error('not a list'); } catch { err("avisoq act: the arguments are a JSON list, for example '[7]'"); return 64; }
    const r = await act(file, args, { entry, tools, allow: flags.allow, limits, log });
    if (flags.json) out(JSON.stringify({ ...r, approval: why, log }, null, 2));
    else {
      for (const c of r.calls) err(`  ${c.tool}(${JSON.stringify(c.args).slice(1, -1)}) ${c.refused ? `REFUSED: ${c.refused}` : c.error !== undefined ? `failed: ${c.error}` : `-> ${JSON.stringify(c.result)}`}`);
      if (r.ok) out(r.result === undefined ? 'done' : typeof r.result === 'string' ? r.result : JSON.stringify(r.result));
      else err(`stopped [${r.error.kind}]: ${r.error.message}`);
      const made = r.calls.filter((c) => !c.refused).length;
      err(`(${why}; ${made} tool call${made === 1 ? '' : 's'}; log: ${log})`);
    }
    return r.ok ? 0 : 2;
  } catch (e) {
    err(`avisoq ${cmd}: ${e.message}`);
    return e.kind === 'compile' ? 65 : 70;
  } finally {
    if (servers) servers.close();
  }
}
