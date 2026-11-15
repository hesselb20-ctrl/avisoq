# Avisoq language reference

Version 0.15. For a guided introduction read the [tutorial](TUTORIAL.md) first. Code blocks
marked as Avisoq on this page are compiled by the test suite.

## Source files

- A file is a list of declarations: `import`, `let` (a constant), `struct`, `enum`, `fn`,
  `extern fn` and `test`. Order does not matter. Execution starts at `fn main()`.
- One statement per line; there are no semicolons. A line that starts with an operator, `(`,
  `[` or `.` continues the previous line.
- Comments start with `//`.
- Names are letters, digits and `_`. Types and variants conventionally start with a capital.

## Types

| Type | Values | Notes |
|---|---|---|
| `Int` | 64-bit signed whole numbers | `42`, `1_000_000`, `-5`, `'a'` (a character literal is its byte value, 97) |
| `Float` | 64-bit floating point | needs a dot: `1.0`, `2.5e-3` |
| `Bool` | `true`, `false` | |
| `Str` | immutable bytes, UTF-8 | `"text"` with escapes `\n \t \" \\`; `s[i]` is a byte, `s[a..b]` a part |
| `[T]` | array | `[1, 2, 3]`, `xs[i]`, `len(xs)`; grows with `push` |
| `Map[K, V]` | map, keys `Int` or `Str` | `{}`; `put`, `get`, `get_or`, `has`, `remove`, `keys`; keeps insertion order |
| `(A, B)` | tuple of 2 to 4 | `(a, b)`; parts are `.first`, `.second`, `.third`, `.fourth` |
| struct | named fields | `struct Point { x: Int, y: Int }`, `Point(x: 1, y: 2)`, `p.x` |
| enum | one of several variants | `enum Shape { Circle(r: Int), Empty }`, `Circle(r: 2)`, `Empty` |
| `fn(A, B) -> R` | a function, as a parameter or a `let` name | pass a function name or a lambda `fn(x) => x * 2` |

There are no implicit conversions: `float(i)`, `int(f)`, `str(x)`. There is no null.

`==` and `!=` work on `Int`, `Float`, `Bool`, `Str` and arrays of those. `< <= > >=` work on
`Int`, `Float` and `Str` (byte order). Comparisons do not chain.

### Generics

```avisoq
struct Pair[A, B] { left: A, right: B }

enum Tree[T] { Leaf(value: T), Node(children: [Tree[T]]) }

fn largest[T: Ord](xs: [T]) -> T
  requires len(xs) > 0
{
  var best = copy(xs[0])
  for x in xs {
    if x > best { best = copy(x) }
  }
  return best
}
```

A type parameter may carry one constraint: `Ord` (`Int`, `Float`, `Str`), `Eq` (`Int`, `Float`,
`Bool`, `Str`) or `Num` (`Int`, `Float`). Type arguments are worked out from the arguments or
the expected type. You cannot declare your own constraints.

## Declarations

### Functions

```avisoq
fn scale(xs: mut [Int], factor: Int) -> Int
  requires factor > 0
  ensures result >= 0
{
  var changed = 0
  for i in 0..len(xs) {
    if xs[i] != 0 {
      xs[i] = xs[i] * factor
      changed += 1
    }
  }
  return changed
}
```

- Parameters are immutable unless marked `mut`. A `mut` array, map or struct parameter changes
  the caller's variable, which must be a `var` (or itself a `mut` parameter).
- After the return type come the effects (`uses io, fs`), then any `requires` and `ensures`
  clauses. Inside `ensures`, `result` is the value being returned.
- `private fn` (also `private struct`, `private enum`, `private let`) is usable only in its file.
- Functions are not values: they can be passed to a parameter of function type, with a lambda
  capturing the variables it reads. A `let` can give one a name, `let sq = square` or
  `let add = fn(x: Int) => x + offset`, which can then be called and passed on; which function
  it names is fixed when the program is compiled. A lambda kept this way needs its parameter
  types and may read only `let` values from outside. Functions cannot be kept in a `var`, an
  array or a field, or returned.

### Constants

```avisoq
let MAX_STEPS = 5000
let HALF = MAX_STEPS / 2
let GREETING = "hello"
```

A top-level `let`. Its value is built from literals, operators and other constants.

### Tests

```avisoq
fn double(n: Int) -> Int {
  return n * 2
}

test "doubling" {
  assert double(21) == 42
  assert [double(1), double(2)] == [2, 4]
}
```

Tests have no effects and each runs in isolation: `avisoq test file.avq`.

### Imports

```
import "std/strings"         // a standard module
import "helpers"             // helpers.avq next to this file
import "pkg:textkit/shout"   // a module of a package listed in avisoq.json
```

Everything a module declares (and does not mark `private`) becomes available by its plain
name. A declaration in your program wins over a standard library function of the same name.

## Statements

| Statement | Form |
|---|---|
| Binding | `let x = e` (immutable), `var x = e` (mutable), `let x: [Int] = []`, `let (a, b) = pair` |
| Assignment | `x = e`, `xs[i] = e`, `p.field = e`, `items[i].field = e`, `(a, b) = pair` |
| Compound | `x += e`, also `-= *= /= %=`, on anything assignable |
| Choice | `if c { } else if d { } else { }` |
| Loops | `while c { }`, `for i in a..b { }` (b excluded), `for i in a..b step k { }` (k a whole number written out; negative counts down, b still excluded), `for x in items { }`, `for i, x in items { }` |
| Loop control | `break`, `continue` (innermost loop) |
| Matching | `match value { Variant(a, b) => { } Other => { } else => { } }`: every variant must be covered |
| Leaving | `return e`, `return` |
| Checking | `assert c` |
| Passing a failure up | `let x = e?`, `x = e?`, `e?` |

- There is no shadowing: a name is declared once per function.
- `for x in items`: `x` is a read-only view of the element; over a `Str` it is each byte.
- `while c invariant e { }` states a condition that holds before the loop and after every
  iteration; it is proved if possible and checked while running otherwise.
- `e?` on a `Result` returns the `Err` from the enclosing function, which must itself return a
  `Result` with the same error type; on an `Option` it returns `None`. It is allowed only at
  the end of a statement.

## Expressions

| Expression | Notes |
|---|---|
| `+ - * / %` | on `Int` and on `Float` (not `%`); `+` joins strings. `/` on `Int` rounds toward zero |
| `and`, `or`, `not` | the right side of `and` / `or` is evaluated only when needed |
| `if c then a else b` | a conditional value; not for arrays or maps |
| `match v { A(x) => e, B => e }` | a value chosen by variant; every variant or an `else` arm; arms separated by commas or new lines; not for arrays or maps |
| `sum(i in a..b: e)` | adds `e` for each `i`; the compiler may run it on several cores |
| `[i in a..b: e]` | an array of `e` for each `i`; likewise |
| `fn(x, y) => e` | a lambda, where a function parameter is expected; `let f = fn(x: Int) => e` names one |
| `Name(field: e, ...)` | builds a struct or an enum variant |
| `copy(e)` | an independent copy of an array, map or a value containing them |

Precedence, loosest first: `or`, `and`, `not`, comparisons, `+ -`, `* / %`, unary `-`, then
indexing, field access and calls.

A match that gives a value, a loop that counts down, and names for functions:

```avisoq
enum Shape { Circle(radius: Int), Box(width: Int, height: Int), Empty }

fn area(s: Shape) -> Int {
  return match s { Circle(radius) => 3 * radius * radius, Box(width, height) => width * height, Empty => 0 }
}

fn square(x: Int) -> Int { return x * x }

fn twice(f: fn(Int) -> Int, x: Int) -> Int { return f(f(x)) }

fn main() uses io {
  print(area(Circle(radius: 2)), area(Box(width: 3, height: 4)), area(Empty))
  var countdown = ""
  for i in 3..0 step -1 { countdown += str(i) + " " }
  print(countdown + "go")
  let sq = square
  let offset = 10
  let shift = fn(x: Int) => x + offset
  print(sq(7), shift(5), twice(sq, 3), twice(shift, 1))
}
```

```output
12 12 0
3 2 1 go
49 15 81 21
```

## Safety rules

- **Arithmetic is checked.** Overflow, division by zero, a shift outside 0 to 63 and a `Float`
  too large for `int()` stop the program. `checked_add`, `checked_sub` and `checked_mul` in
  `std/math` return an `Option` instead.
- **Indexes are checked.** So are map keys read with `get`, and `pop` on an empty array.
- **No sharing.** An array or map belongs to one binding. Storing it somewhere else needs
  `copy(...)`, unless this is the last use of the variable, the variable is reassigned straight
  after, or the value is given away in a `return`; then it moves.
- **Effects are declared.** A function that prints, reads the clock, uses files, the network,
  another program or C code says so, and so does every caller.
- **A stopped program says why.** A failure has a kind, a message and the source position.

### Effects and capabilities

| Effect | Needed for | Grant when running |
|---|---|---|
| `io` | `print` | `--allow io` |
| `time` | `now_ms` | `--allow time` |
| `fs` | `read_file`, `write_file`, `file_exists` | `--allow fs:<folder>` (or `fs` for anywhere) |
| `net` | `http_get`, `http_post` | `--allow net:<host>` (or `net`) |
| `run` | `run_command` | `--allow run:<program>` (or `run`) |
| `ffi` | calling an `extern` function | `--allow ffi` |
| `host` | calling a function the embedding program provides (`extern "host"`) | by passing that function in `host` when loading |

A program that needs a capability it was not given does not start. A path outside a granted
folder, a host or a program that was not granted is refused when it is used.

### Contracts

`requires`, `ensures` and `invariant` take a `Bool` expression. The compiler tracks the range
of each `Int` and array length and linear relations between them. A contract it can prove
costs nothing at run time; one it can prove is always broken is a compile error; the rest are
checked while the program runs.

## Built-in functions

| Function | Result |
|---|---|
| `print(a, b, ...)` | writes the values separated by spaces, then a newline (effect `io`) |
| `len(x)` | length of an array, map or string |
| `array(n, value)` | an array of `n` copies of `value` |
| `push(xs, v)`, `pop(xs)` | add at the end; remove and return the last element |
| `copy(x)` | an independent copy |
| `float(i)`, `int(f)`, `str(x)` | conversions; `str` takes `Int`, `Float` or `Bool` |
| `sqrt(f)` | square root of a `Float` |
| `substr(s, a, b)`, `byte_at(s, i)`, `chr(b)` | part of a string; a byte; a one-byte string |
| `put(m, k, v)`, `get(m, k)`, `get_or(m, k, d)`, `has(m, k)`, `remove(m, k)`, `keys(m)` | maps |
| `bit_and`, `bit_or`, `bit_xor`, `shift_left(a, n)`, `shift_right(a, n)` | bit operations on `Int` |
| `now_ms()` | milliseconds, as a `Float` (effect `time`) |
| `read_file(path)`, `write_file(path, text)`, `file_exists(path)` | files; the first two return a `Result` (effect `fs`) |
| `http_get(url)`, `http_post(url, body, content_type)` | return `Result[Str, Str]` (effect `net`) |
| `run_command(program, args, input)` | starts a program; `Result[Str, Str]` (effect `run`) |

## Standard library

### `std/core` (always available)

`Option[T]` (`Some(value)`, `None`), `Result[T, E]` (`Ok(value)`, `Err(error)`), tuples.
`is_some(o)`, `unwrap_or(o, fallback)`, `is_ok(r)`, `value_or(r, fallback)`, `equal(a, b)`.

### `std/strings`

| Function | Notes |
|---|---|
| `split(s, separator) -> [Str]`, `join(parts, separator)`, `lines(s)` | |
| `trim(s)`, `to_upper(s)`, `to_lower(s)`, `reversed(s)`, `repeat(s, times)` | |
| `replace(s, from, to)`, `pad_left(s, width, fill)`, `pad_right(s, width, fill)` | `fill` is a one-character string |
| `contains(s, needle)`, `starts_with(s, prefix)`, `ends_with(s, suffix)`, `matches_at(s, at, needle)` | |
| `index_of(s, needle)`, `last_index_of(s, needle)` | position, or -1 |
| `count_of(s, needle)` | occurrences, not counting overlaps |
| `matches_glob(pattern, text)` | `*` is any run of characters, `?` any one |
| `parse_int(s) -> Option[Int]` | `None` if it is not a number or does not fit |
| `is_digit(b)`, `is_letter(b)`, `is_lower(b)`, `is_upper(b)`, `is_alnum(b)`, `is_space(b)` | take a byte |

### `std/arrays`

| Function | Notes |
|---|---|
| `sort(xs)`, `sorted(xs)`, `sort_by(xs, key)` | `sort` and `sort_by` change the array; `sort_by` is stable |
| `reverse(xs)`, `concat(a, b)`, `append(xs, x)`, `slice(xs, start, end)`, `unique(xs)`, `range(a, b)` | return new arrays |
| `map(xs, f)`, `filter(xs, keep)`, `fold(xs, start, step)`, `each(xs, f)` | take a function or lambda |
| `any(xs, check)`, `all(xs, check)`, `count_if(xs, check)`, `find_index(xs, check)` | |
| `index_in(xs, x)`, `includes(xs, x)`, `max_of(xs)`, `min_of(xs)`, `last_of(xs)`, `sum_of(xs, zero)` | |
| `swap(xs, i, j)` | changes the array |

### `std/math`

`min(a, b)`, `max(a, b)`, `clamp(x, lo, hi)`, `abs(i)`, `abs_float(f)`, `pow(base, exponent)`,
`checked_add`, `checked_sub`, `checked_mul` (each `-> Option[Int]`), `int_max()`, `int_min()`.

### `std/bigint`

Whole numbers of any size, as the struct `BigInt`. `big(text)`, `big_parse(text) -> Option[BigInt]`,
`big_from_int(n)`, `big_str(a)`, `big_to_int(a) -> Option[Int]`, `big_add`, `big_sub`, `big_mul`,
`big_div` (rounds toward zero), `big_rem` (sign of the first argument), `big_divmod(a, b)`,
`big_pow(a, n)`, `big_neg`, `big_abs`, `big_cmp(a, b)` (-1, 0, 1), `big_eq`, `big_is_zero`.

### `std/json`

`json_parse(text) -> Result[Json, Str]` and `json_text(j) -> Str`. `Json` is an enum: `JNull`,
`JBool(value)`, `JNumber(value: Float)`, `JText(value)`, `JArray(items)`,
`JObject(names, values)`. `json_get(j, name)`, `json_at(j, index)`, `json_len(j)`, and
`json_str`, `json_num`, `json_int`, `json_bool`, which take an `Option[Json]` so that lookups
chain.

## Working with other languages

```
extern "shim.c" fn add_squares(a: Int, b: Int) -> Int        // a C file next to this one
extern "m" fn cos(x: Float) -> Float                          // the C library: "c" or "m"
extern "shim.c" link "sqlite3" fn count_rows(path: Str) -> Int   // also link a library
```

An `extern` function is C code: native backend only, effect `ffi`, and only `Int`
(`long long`), `Float` (`double`), `Bool` and `Str` (`const char*`) cross over.

`extern "host" fn unit_price(product: Str) -> Int` declares a function that the program
embedding this code provides (`load(file, { host: { unit_price: ... } })` in JavaScript, or
`avisoq mcp file.avq --host module.mjs`). Same four types, effect `host`, WebAssembly route.

In the other direction, `import { load } from 'avisoq'` (JavaScript),
`bindings/python/avisoq.py` (Python), `avisoq call` and `avisoq serve` let other languages call
any Avisoq function that is not `private` and takes no `mut`, `Map` or function parameters.
Each call can be given a time limit and a memory limit (`timeLimitMs`, `memoryLimitMb`;
`--time-limit`, `--memory`); going over is a failure of kind `time_limit` or `out_of_memory`.
`avisoq mcp file.avq` serves the same functions as tools for AI agents.

## Command line

| Command | Does |
|---|---|
| `avisoq check file.avq` | types, effects and contracts, without running |
| `avisoq run file.avq --allow io` | runs `main` in the WebAssembly sandbox; `--native` for machine code |
| `avisoq test file.avq` | runs every `test` block |
| `avisoq fmt file.avq` | rewrites the file in the canonical layout (`--check` only reports) |
| `avisoq build file.avq -o out` | a `.wasm` file, or an executable with `--native` |
| `avisoq call file.avq name '[args]'` | calls one function and prints the result as JSON |
| `avisoq serve file.avq` | answers function calls as JSON lines |
| `avisoq mcp file.avq` | serves every callable function as a tool over the Model Context Protocol (`--host module.mjs`, `--time-limit`, `--memory`, `--allow`) |
| `avisoq guide` | prints the guide written for AI models |
| `avisoq lsp` | language server on stdin and stdout |
| `avisoq init`, `add`, `install` | packages |

`--json` gives machine-readable output. `--unchecked` turns off overflow checks (bounds checks
stay). `--memory <MB>` limits a native program.

## Failure kinds

A program that stops reports one of: `overflow`, `division_by_zero`, `bounds`, `missing_key`,
`array_size`, `out_of_memory`, `stack_overflow`, `assert`, `precondition`, `postcondition`,
`invariant`, `capability_denied`, `unsupported`, `trap`.
