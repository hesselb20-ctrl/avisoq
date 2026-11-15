// Which functions of a program can be called from another language, and how they are described
// to the caller. Shared by both backends (see src/embed.mjs).
import { isMap } from './types.mjs';

const plain = (t) => !isMap(t) && !t.startsWith('Fn[') && !t.includes('Map[') && !t.includes('Fn[');
const own = (f) => !/[\\/]std[\\/][a-z_]+\.avq$/.test(f.file ?? '');

// Every function of the program's own files that takes and returns plain data.
export function callableFns(program) {
  return program.fns.filter((f) => !(f.generic || f === program.main || f.extern || !own(f) || f.private || f.name.startsWith('__') || (f.fnParams && f.fnParams.size)
    || f.params.some((p) => p.mut || !plain(p.ty)) || !plain(f.ret)));
}

export const describeFn = (f) => ({ name: f.name, params: f.params.map((p) => ({ name: p.name, ty: p.ty })), ret: f.ret, effects: [...f.effectSet] });

export const describeTypes = (program) => ({
  structs: Object.fromEntries([...program.types.structs].map(([t, s]) => [t, s.fields.map((f) => ({ name: f.name, ty: f.ty }))])),
  enums: Object.fromEntries([...program.types.enums].map(([t, e]) => [t, e.variants.map((v) => ({ name: v.name, fields: v.fields.map((f) => ({ name: f.name, ty: f.ty })) }))])),
});
