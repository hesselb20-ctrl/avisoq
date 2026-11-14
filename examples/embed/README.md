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
