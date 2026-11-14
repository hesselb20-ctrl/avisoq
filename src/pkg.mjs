// Packages: a project lists what it depends on in avisoq.json, and imports it as "pkg:name/module".
//
//   { "name": "myapp", "version": "0.1.0",
//     "dependencies": { "textkit": { "path": "../textkit" },
//                       "geo":     { "git": "https://example.com/geo.git", "rev": "v1.2.0" } } }
//
// A path dependency is used where it is. A git dependency is fetched by `avisoq install` into
// avisoq_modules/<name>, and the exact commit is recorded in avisoq.lock.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const MANIFEST = 'avisoq.json';

// The nearest avisoq.json at or above dir, or null.
export function findManifest(dir) {
  let d = resolve(dir);
  for (;;) {
    const file = join(d, MANIFEST);
    if (existsSync(file)) {
      try { return { dir: d, file, data: JSON.parse(readFileSync(file, 'utf8')) }; } catch (e) { return { dir: d, file, error: `avisoq.json is not valid JSON: ${e.message}` }; }
    }
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

// "pkg:name/module" imported from a file in `fromDir` -> { path } or { error, hint }.
export function resolvePackageImport(spec, fromDir) {
  const rest = spec.slice(4);
  const slash = rest.indexOf('/');
  const name = slash < 0 ? rest : rest.slice(0, slash);
  const module = slash < 0 ? 'main' : rest.slice(slash + 1);
  const m = findManifest(fromDir);
  if (!m) return { error: `'${spec}' needs a avisoq.json that lists the package '${name}'`, hint: 'create one with: avisoq init' };
  if (m.error) return { error: m.error };
  const dep = m.data.dependencies?.[name];
  if (!dep) return { error: `package '${name}' is not listed in ${m.file}`, hint: `add it with: avisoq add ${name} <path or git url>` };
  const root = dep.path ? resolve(m.dir, dep.path) : join(m.dir, 'avisoq_modules', name);
  if (!existsSync(root)) {
    return dep.path ? { error: `package '${name}' points to ${root}, which does not exist` }
      : { error: `package '${name}' has not been fetched yet`, hint: 'run: avisoq install' };
  }
  return { path: join(root, `${module}.avq`) };
}

export function init(dir, name) {
  const file = join(dir, MANIFEST);
  if (existsSync(file)) return { ok: false, message: `${file} already exists` };
  writeFileSync(file, `${JSON.stringify({ name, version: '0.1.0', dependencies: {} }, null, 2)}\n`);
  return { ok: true, message: `created ${file}` };
}

export function add(dir, name, source, rev) {
  const m = findManifest(dir);
  if (!m) return { ok: false, message: 'no avisoq.json here; create one with: avisoq init' };
  if (m.error) return { ok: false, message: m.error };
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) return { ok: false, message: `'${name}' is not a valid package name` };
  const isGit = /^(https?:|git@|ssh:|file:)/.test(source) || source.endsWith('.git');
  m.data.dependencies = { ...(m.data.dependencies ?? {}), [name]: isGit ? { git: source, ...(rev ? { rev } : {}) } : { path: source } };
  writeFileSync(m.file, `${JSON.stringify(m.data, null, 2)}\n`);
  return { ok: true, message: `added ${name} (${isGit ? 'git' : 'path'}) to ${m.file}${isGit ? '; run: avisoq install' : ''}` };
}

// Fetches every git dependency of the project at dir, and of the packages it pulls in.
export function install(dir, log = () => {}, seen = new Set()) {
  const m = findManifest(dir);
  if (!m) return { ok: false, message: 'no avisoq.json here; create one with: avisoq init' };
  if (m.error) return { ok: false, message: m.error };
  if (seen.has(m.dir)) return { ok: true, message: 'nothing to do' };
  seen.add(m.dir);
  const lock = {};
  for (const [name, dep] of Object.entries(m.data.dependencies ?? {})) {
    let root;
    if (dep.git) {
      root = join(m.dir, 'avisoq_modules', name);
      mkdirSync(join(m.dir, 'avisoq_modules'), { recursive: true });
      rmSync(root, { recursive: true, force: true });
      try {
        // Arguments are passed as a list, never through a shell.
        execFileSync('git', ['clone', '--quiet', dep.git, root], { stdio: ['ignore', 'pipe', 'pipe'] });
        if (dep.rev) execFileSync('git', ['-C', root, 'checkout', '--quiet', dep.rev], { stdio: ['ignore', 'pipe', 'pipe'] });
        lock[name] = { git: dep.git, commit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
      } catch (e) {
        return { ok: false, message: `could not fetch package '${name}' from ${dep.git}: ${String(e.stderr ?? e.message).trim()}` };
      }
      log(`fetched ${name} at ${lock[name].commit.slice(0, 12)}`);
    } else if (dep.path) {
      root = resolve(m.dir, dep.path);
      if (!existsSync(root)) return { ok: false, message: `package '${name}' points to ${root}, which does not exist` };
      log(`using ${name} from ${root}`);
    } else {
      return { ok: false, message: `package '${name}' needs either "path" or "git" in ${m.file}` };
    }
    // A package may have dependencies of its own.
    if (existsSync(join(root, MANIFEST))) {
      const inner = install(root, log, seen);
      if (!inner.ok) return inner;
    }
  }
  if (Object.keys(lock).length) writeFileSync(join(m.dir, 'avisoq.lock'), `${JSON.stringify(lock, null, 2)}\n`);
  return { ok: true, message: `installed ${Object.keys(m.data.dependencies ?? {}).length} package(s)` };
}
