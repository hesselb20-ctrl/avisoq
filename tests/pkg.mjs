// Tests for private declarations and packages, through the real command line.   node tests/pkg.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compile } from '../src/compiler.mjs';

let passed = 0, failed = 0;
const report = (name, ok, detail) => { if (ok) passed++; else { failed++; console.log(`FAIL  ${name}\n      ${detail}`); } };
const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.mjs');
const avisoq = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const codes = (src) => compile(src).diagnostics.map((d) => d.code);

// ---- private ----
report('a private function cannot be used from another file', codes('import "std/strings"\nfn main() uses io { print(is_space(32)) }').includes('E0702'), codes('import "std/strings"\nfn main() uses io { print(is_space(32)) }').join(','));
report('a private function works inside its own file', compile('private fn helper(x: Int) -> Int { return x + 1 }\nfn main() uses io { print(helper(1)) }').ok, '');
report('private applies to structs', codes('private struct Hidden { x: Int }\nfn main() { }').length === 0, '');
report('private must precede a declaration', codes('private let x = 1').includes('E0001'), '');

// ---- packages ----
const root = mkdtempSync(join(tmpdir(), 'avisoq-pkg-'));
const app = join(root, 'app'), kit = join(root, 'textkit'), geo = join(root, 'geo-src');
for (const d of [app, kit, geo]) mkdirSync(d);
writeFileSync(join(kit, 'shout.avq'), 'private fn mark() -> Str { return "!" }\nfn shout(s: Str) -> Str { return s + mark() }\n');
writeFileSync(join(app, 'main.avq'), 'import "pkg:textkit/shout"\nfn main() uses io { print(shout("hi")) }\n');

let r = avisoq(app, 'run', 'main.avq', '--allow', 'io');
report('a package import needs a manifest', r.code === 1 && r.err.includes('E0703') && r.err.includes('avisoq init'), r.err);
r = avisoq(app, 'init', 'app');
report('init creates avisoq.json', r.code === 0 && JSON.parse(readFileSync(join(app, 'avisoq.json'), 'utf8')).name === 'app', r.out + r.err);
report('init refuses to overwrite', avisoq(app, 'init').code === 1, '');
r = avisoq(app, 'run', 'main.avq', '--allow', 'io');
report('an unlisted package is reported with the fix', r.code === 1 && r.err.includes('avisoq add textkit'), r.err);
r = avisoq(app, 'add', 'textkit', '../textkit');
report('add records a path dependency', r.code === 0 && JSON.parse(readFileSync(join(app, 'avisoq.json'), 'utf8')).dependencies.textkit.path === '../textkit', r.out + r.err);
r = avisoq(app, 'run', 'main.avq', '--allow', 'io');
report('a path package is imported and run', r.code === 0 && r.out === 'hi!\n', r.out + r.err);
writeFileSync(join(app, 'bad.avq'), 'import "pkg:textkit/shout"\nfn main() uses io { print(mark()) }\n');
r = avisoq(app, 'check', 'bad.avq');
report('private names of a package stay private', r.code === 1 && r.err.includes('E0702'), r.err);

// A git dependency, served from a local repository so the test needs no network.
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'init.defaultBranch=main', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
writeFileSync(join(geo, 'area.avq'), 'fn square_area(side: Int) -> Int { return side * side }\n');
git(geo, 'init', '--quiet');
git(geo, 'add', '.');
git(geo, 'commit', '--quiet', '-m', 'first');
const first = git(geo, 'rev-parse', 'HEAD').trim();
writeFileSync(join(geo, 'area.avq'), 'fn square_area(side: Int) -> Int { return side * side * 1000 }\n');
git(geo, 'commit', '--quiet', '-am', 'second');
const url = pathToFileURL(geo).href;
writeFileSync(join(app, 'geo.avq'), 'import "pkg:geo/area"\nfn main() uses io { print(square_area(3)) }\n');

r = avisoq(app, 'add', 'geo', url);
report('add records a git dependency', r.code === 0 && JSON.parse(readFileSync(join(app, 'avisoq.json'), 'utf8')).dependencies.geo.git === url, r.out + r.err);
r = avisoq(app, 'run', 'geo.avq', '--allow', 'io');
report('a git package must be installed first', r.code === 1 && r.err.includes('avisoq install'), r.err);
r = avisoq(app, 'install');
const lock = existsSync(join(app, 'avisoq.lock')) ? JSON.parse(readFileSync(join(app, 'avisoq.lock'), 'utf8')) : {};
report('install fetches the package and writes the lock file', r.code === 0 && /^[0-9a-f]{40}$/.test(lock.geo?.commit ?? '') && existsSync(join(app, 'avisoq_modules', 'geo', 'area.avq')), r.out + r.err);
r = avisoq(app, 'run', 'geo.avq', '--allow', 'io');
report('the installed package runs at the latest commit', r.code === 0 && r.out === '9000\n', r.out + r.err);
avisoq(app, 'add', 'geo', url, '--rev', first);
r = avisoq(app, 'install');
r = avisoq(app, 'run', 'geo.avq', '--allow', 'io');
report('a pinned revision is honoured', r.code === 0 && r.out === '9\n' && JSON.parse(readFileSync(join(app, 'avisoq.lock'), 'utf8')).geo.commit === first, r.out + r.err);
avisoq(app, 'add', 'ghost', pathToFileURL(join(root, 'does-not-exist')).href);
r = avisoq(app, 'install');
report('a package that cannot be fetched is a clear error', r.code === 1 && r.err.includes("could not fetch package 'ghost'"), r.out + r.err);

rmSync(root, { recursive: true, force: true });
console.log(`[pkg] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
