# Using Avisoq from another language

`scoring.avq` holds a few functions. Any of them can be called from JavaScript, from Python,
or from anything that can start a process, without writing glue code. The Avisoq code runs in
the WebAssembly sandbox and gets only the capabilities you grant.

## From JavaScript (Node)

```js
import { load } from 'avisoq';

const scoring = await load('scoring.avq');
scoring.score([3, -1, 50, 8], 10);        // 21
scoring.summarise([1, 2, 4], 'week');     // { count: 3, total: 7, mean: 2.33..., label: 'WEEK' }
scoring.divmod(17, 5);                    // [3, 2]
scoring.parse_port('x');                  // { variant: 'Err', error: 'not a number: x' }
scoring.divmod(1, 0);                     // throws AvisoqError, kind 'precondition'
```

## From Python

```python
import avisoq                              # bindings/python/avisoq.py, no dependencies

with avisoq.load("scoring.avq") as scoring:
    scoring.score([3, -1, 50, 8], 10)      # 21
    scoring.factorial(30)                  # '265252859812191058636308480000000'
```

## From the command line, or any other language

```
avisoq call scoring.avq score '[[3, -1, 50, 8], 10]'      # prints 21
avisoq serve scoring.avq                                   # then one JSON request per line:
{"id": 1, "fn": "score", "args": [[3, -1, 50, 8], 10]}
{"id": 1, "ok": true, "result": 21, "output": ""}
```

## At native speed

Everything above runs in the WebAssembly sandbox. The same functions can be compiled to machine
code and called inside your own process instead (GCC must be installed):

```js
const scoring = await load('scoring.avq', { native: true });
scoring.score([3, -1, 50, 8], 10);        // 21, same answers, same errors
```

```python
scoring = avisoq.load("scoring.avq", native=True)
```

Or build the library once and ship it; loading it then needs no compiler, and from Python no
Node either:

```
avisoq build scoring.avq --shared -o scoring.dll      # .so on Linux, .dylib on macOS
```

```js
import { open } from 'avisoq';
const scoring = await open('scoring.dll');
```

```python
scoring = avisoq.open_library("scoring.dll")
```

`node examples/embed/speed.mjs` times both routes on your machine. On the machine this was
written on, native is 1.7 to 23 times faster from JavaScript when a call does real work, and
about 0.1 microseconds slower per call when it does none.

What you give up for the speed:

- **No virtual-machine sandbox.** The code still cannot use a capability it was not built with
  (`--allow` at build time, `allow` in `load`), and a failure inside it is still an error in
  your language, never a crash. But it runs as ordinary machine code in your process.
- **Deep recursion ends the process.** In WebAssembly a stack overflow is an error you can
  catch; in a native library it is not.
- **One thread.** Loops that the native backend would spread over cores run on one, and the
  library must not be called from two threads at once (the Python binding takes a lock).
- **Printing goes straight to standard output**, not to `$output()`.
- From JavaScript it uses `node:ffi`, which needs Node 26 and prints an "experimental" warning.

Any language that can call C can use the library directly. It exports three functions:

```c
int64_t avisoq_describe(uint8_t* out, int64_t cap);   // JSON: the functions and their types
int64_t avisoq_call(int32_t fn, const uint8_t* in, int64_t in_len, uint8_t* out, int64_t out_cap);
int64_t avisoq_take(uint8_t* out, int64_t cap);       // the last result, if it did not fit
```

`fn` is the function's position in the list from `avisoq_describe`. Arguments go in, and the
result comes out, as little-endian bytes: `Int` and `Float` 8 bytes, `Bool` 1 byte, `Str` a
length (8 bytes) and its UTF-8 bytes, an array a count (8 bytes) and its elements, a struct or
tuple its fields in order, an enum the variant's number (8 bytes) and that variant's fields.
`avisoq_call` returns the length of the result; a failure returns `-1 - length` and the bytes
are a JSON object with `kind` and `message`.

## How values cross over

| Avisoq | JavaScript | Python / JSON |
|---|---|---|
| `Int` | number, or bigint when it is too large to be exact | int (sent as a string above 2^53) |
| `Float`, `Bool`, `Str` | number, boolean, string | float, bool, str |
| `[T]` | array | list |
| `(A, B)` | array | list |
| struct | object with its fields | dict |
| enum | `{ variant: "Name", field: value }` | the same, as a dict |

A function can be called from outside if it is not `private` and takes no `mut`, `Map` or
function parameters. Each call's memory is handed back when it returns. A function that prints
needs `allow: ['io']` (`allow=["io"]` in Python); what it printed is in `module.$output()`
(`module.output` in Python).
