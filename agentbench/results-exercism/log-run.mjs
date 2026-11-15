// node log-run.mjs <model> <run> <language> <seconds> <thousand tokens>   records what one agent run cost
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const f = new URL('./runs.json', import.meta.url);
const runs = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
const [model, run, language, seconds, ktokens] = process.argv.slice(2);
const rest = runs.filter((r) => !(r.model === model && r.run === Number(run) && r.language === language));
rest.push({ model, run: Number(run), language, seconds: Number(seconds), ktokens: Number(ktokens) });
writeFileSync(f, `${JSON.stringify(rest, null, 1)}\n`);
console.log(`${rest.length} runs logged`);
