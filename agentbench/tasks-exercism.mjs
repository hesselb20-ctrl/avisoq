// Tasks and tests from the Exercism problem specifications (MIT licence, copyright Exercism),
// selected mechanically by exercism.mjs. See tasks-exercism.json for the source commit.
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('./tasks-exercism.json', import.meta.url), 'utf8'));
export const SOURCE = data;
export const TASKS = data.tasks.map((t) => {
  const expected = new Map(t.tests.map((c) => [JSON.stringify(c.args), c.expected]));
  return { id: t.id, params: t.params, ret: t.ret, desc: t.desc, examples: t.examples, tests: t.tests.map((c) => c.args), ref: (...args) => expected.get(JSON.stringify(args)) };
});
