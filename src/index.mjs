// The Avisoq package: use Avisoq code from JavaScript, or drive the compiler.
//
//   import { load } from 'avisoq';
//   const m = await load('scoring.avq');
//   m.score([3, 5, 8])
export { load, serve, AvisoqError } from './embed.mjs';
export { compile, run, runTests, analyze, buildNative } from './compiler.mjs';
