// Collects every graded run of the Exercism task set into one table, and copies the solutions
// next to it so the numbers can be checked.
//
//   node agentbench/results-exercism/summary.mjs
//
// Reads agentbench/work-exercism/<model>-r<n>/results-round1.json (written by
// `run.mjs grade 1 --set exercism --work work-exercism/<model>-r<n>`), runs.json (what each
// Claude run cost) and, for a local model, <language>/local-model-log.json.
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const work = new URL('../work-exercism/', import.meta.url);
const here = new URL('./', import.meta.url);
const runs = JSON.parse(readFileSync(new URL('./runs.json', here), 'utf8'));
const LANGS = ['avisoq', 'python', 'rust'];
const NAME = { avisoq: 'Avisoq', python: 'Python', rust: 'Rust' };
const cells = {}; // model -> language -> [{ run, pass, compile, loud, silent, seconds, ktokens, failed: [] }]

for (const dir of readdirSync(work).sort()) {
  const m = /^(.+)-r(\d+)$/.exec(dir);
  const file = new URL(`./${dir}/results-round1.json`, work);
  if (!m || !existsSync(file)) continue;
  const [, model, run] = m;
  const results = JSON.parse(readFileSync(file, 'utf8'));
  for (const lang of LANGS) {
    const states = Object.entries(results[lang] ?? {});
    if (!states.length) continue;
    const count = (s) => states.filter(([, v]) => v === s).length;
    const cost = runs.find((r) => r.model === model && r.run === Number(run) && r.language === lang);
    const local = new URL(`./${dir}/${lang}/local-model-log.json`, work);
    const log = existsSync(local) ? JSON.parse(readFileSync(local, 'utf8')) : null;
    ((cells[model] ??= {})[lang] ??= []).push({
      run: Number(run), total: states.length, pass: count('pass'), compile: count('compile'), loud: count('loud'), silent: count('silent'),
      seconds: cost?.seconds ?? log?.seconds ?? null, ktokens: cost?.ktokens ?? (log ? Math.round(log.tokens / 1000) : null),
      attempts: log ? log.tasks.reduce((n, t) => n + t.attempts, 0) : null,
      failed: states.filter(([, v]) => v !== 'pass').map(([k, v]) => `${k} (${{ compile: 'rejected', loud: 'stopped', silent: 'wrong' }[v]})`),
    });
    cpSync(new URL(`./${dir}/${lang}/solutions/`, work), new URL(`./${dir}/${lang}/`, here), { recursive: true });
  }
}

const mean = (xs) => (xs.some((x) => x === null) || !xs.length ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
const lines = [];
for (const [model, byLang] of Object.entries(cells)) {
  const n = Math.max(...Object.values(byLang).map((r) => r.length));
  lines.push(`### ${model} (${n} run${n === 1 ? '' : 's'} per language)`, '');
  lines.push('| Language | Correct per run | Total | Rejected before running | Stopped with an error | Silently wrong | Time per run | Mean time | Mean tokens |');
  lines.push('|---|---|---:|---:|---:|---:|---|---:|---:|');
  for (const lang of LANGS) {
    const rs = (byLang[lang] ?? []).sort((a, b) => a.run - b.run);
    if (!rs.length) continue;
    const sum = (k) => rs.reduce((t, r) => t + r[k], 0);
    const secs = mean(rs.map((r) => r.seconds)), toks = mean(rs.map((r) => r.ktokens));
    lines.push(`| ${NAME[lang]} | ${rs.map((r) => r.pass).join(', ')} | ${sum('pass')} of ${sum('total')} | ${sum('compile')} | ${sum('loud')} | ${sum('silent')} | ${rs.map((r) => (r.seconds === null ? '?' : `${r.seconds} s`)).join(', ')} | ${secs === null ? '?' : `${Math.round(secs)} s`} | ${toks === null ? '?' : `${Math.round(toks)}k`} |`);
  }
  const fails = LANGS.flatMap((lang) => (byLang[lang] ?? []).flatMap((r) => r.failed.map((f) => `${NAME[lang]} run ${r.run}: ${f}`)));
  lines.push('', fails.length ? `Failures: ${fails.join('; ')}.` : 'No failures.', '');
}
writeFileSync(new URL('./SUMMARY.md', here), `${lines.join('\n')}\n`);
writeFileSync(new URL('./summary.json', here), `${JSON.stringify(cells, null, 1)}\n`);
console.log(lines.join('\n'));
