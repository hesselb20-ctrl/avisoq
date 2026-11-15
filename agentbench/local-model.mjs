// Runs a task set with a model behind an OpenAI-compatible chat endpoint (for example a local
// llama.cpp server), one task at a time, in the same loop for every language:
//
//   1. The model gets the task (for Avisoq also the one-page guide) and writes one file.
//   2. The file is compiled and run on the two example cases shown in the task.
//   3. If that fails, the model gets the compiler error or the wrong example result and tries
//      again, up to `--tries` times in total.
//
// The hidden test cases are never used here: grade afterwards with run.mjs.
//
//   node agentbench/local-model.mjs --lang avisoq --set exercism --work work-exercism/qwen-r1 [--base http://127.0.0.1:8080] [--tries 3]
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeOne, LANGS, TASKS, signature, work, shown } from './run.mjs';

const flag = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const lang = flag('lang', 'avisoq');
const base = flag('base', 'http://127.0.0.1:8080');
const tries = Number(flag('tries', '3'));
const L = LANGS[lang];
if (!L) { console.log('--lang must be avisoq, python or rust'); process.exit(64); }

const guide = lang === 'avisoq' ? readFileSync(fileURLToPath(new URL('../docs/AGENT_GUIDE.md', import.meta.url)), 'utf8') : '';
const rules = {
  avisoq: 'Write Avisoq. Everything you need to know about the language is in the guide below. The file must not define `main`.',
  python: 'Write Python 3 using only the standard library. The file must not print anything or run code when imported.',
  rust: 'Write Rust using only the standard library (no crates). The file must not define `main`.',
}[lang];
const system = `You are an expert programmer. ${rules} Reply with the complete file in one fenced code block and nothing else.${guide ? `\n\n----- GUIDE -----\n${guide}` : ''}`;

const taskText = (t) => `${t.desc}\n\nWrite the function with exactly this signature (helper functions are allowed):\n\n${signature(lang, t)}\n\n`
  + `Examples:\n${(t.examples ?? []).map((x) => `- ${t.id}(${x.args.map(shown).join(', ')}) gives ${shown(x.expected)}`).join('\n')}\n\nThe function will be tested on other inputs too, so follow the statement exactly.`;

async function ask(messages) {
  const started = Date.now();
  const r = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, temperature: 0.2, max_tokens: 8000 }),
    signal: AbortSignal.timeout(900000),
  });
  if (!r.ok) throw new Error(`model server answered ${r.status}`);
  const j = await r.json();
  return { text: j.choices[0].message.content ?? '', tokens: j.usage?.completion_tokens ?? 0, ms: Date.now() - started };
}
const code = (text) => { const blocks = [...text.matchAll(/```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/g)]; return (blocks.length ? blocks[blocks.length - 1][1] : text).replace(/\r/g, ''); };

mkdirSync(join(work, lang, 'solutions'), { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'localmodel-'));
const log = { model: flag('model', 'local'), lang, tries, tasks: [] };
for (const t of TASKS) {
  const file = join(work, lang, 'solutions', `${t.id}.${L.ext}`);
  const messages = [{ role: 'system', content: system }, { role: 'user', content: taskText(t) }];
  const entry = { id: t.id, attempts: 0, tokens: 0, ms: 0, examples: 'fail' };
  for (let k = 0; k < tries; k++) {
    let answer;
    try { answer = await ask(messages); } catch (e) { entry.error = e.message; break; }
    entry.attempts++; entry.tokens += answer.tokens; entry.ms += answer.ms;
    writeFileSync(file, code(answer.text));
    const check = t.examples?.length ? gradeOne(lang, t, tmp, t.examples) : { state: 'pass' };
    if (check.state === 'pass') { entry.examples = 'pass'; break; }
    const what = { compile: 'It does not compile', loud: 'It stops with an error on an example', silent: 'It gives a wrong result on an example' }[check.state];
    messages.push({ role: 'assistant', content: answer.text }, { role: 'user', content: `${what}:\n\n${check.detail}\n\nReply with the corrected complete file in one fenced code block.` });
  }
  log.tasks.push(entry);
  process.stderr.write(`${lang.padEnd(7)} ${t.id.padEnd(24)} examples ${entry.examples} after ${entry.attempts} attempt${entry.attempts === 1 ? '' : 's'} (${Math.round(entry.ms / 1000)} s)${entry.error ? ` ${entry.error}` : ''}\n`);
}
rmSync(tmp, { recursive: true, force: true });
log.seconds = Math.round(log.tasks.reduce((n, x) => n + x.ms, 0) / 1000);
log.tokens = log.tasks.reduce((n, x) => n + x.tokens, 0);
writeFileSync(join(work, lang, 'local-model-log.json'), `${JSON.stringify(log, null, 1)}\n`);
console.log(`${lang}: ${log.tasks.filter((x) => x.examples === 'pass').length} of ${TASKS.length} pass their examples; ${log.seconds} s of model time, ${log.tokens} tokens written`);
