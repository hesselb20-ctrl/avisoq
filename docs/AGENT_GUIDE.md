# Avisoq guide for AI agents

Everything needed to write correct Avisoq. Read it fully before writing code: several rules
differ from the languages you know. Print this guide any time with `avisoq guide`.

## The rules that most often trip you up

1. **No semicolons. One statement per line.** A line that starts with an operator, `(`, `[` or
   `.` does NOT continue the previous line. To split a long expression, end the line with the
   operator.
2. **No shadowing.** A name may be declared once per function, including across nested blocks.
   Two sibling loops may reuse a name. Never reuse a parameter name, a function name, a type
   name or a built-in name (`len`, `keys`, `str`, `int`, `sum`, `get`, `test`, `result` ...) for a
   variable.
3. **No implicit conversions.** `Int` and `Float` never mix: write `float(i)` or `int(f)`.
   Build text with `str(x)`: `"n = " + str(n)`.
4. **`let` is immutable, `var` is mutable.** Parameters are immutable. To change an array or
   map argument, the parameter must be `mut`: `fn fill(xs: mut [Int])`.
5. **Blocks always use braces**, and `if` conditions have no parentheses: `if x > 0 { ... }`.
   There is no `else if` shorthand problem: `else if` works. There is no ternary and no
   `if` expression; use an `if` statement.
6. **Logic is spelled out:** `and`, `or`, `not`. Never `&&`, `||`, `!`.
7. **Every path of a function with a return type must end in `return`.**
8. **Effects are declared.** A function that calls `print` needs `uses io` after its signature,
   and so does every function that calls it. Pure helper functions have no `uses`.
9. **Integers are 64-bit and checked.** Overflow, division by zero and out-of-range indexes stop
   the program. `/` truncates toward zero, `%` takes the sign of the left side.
10. **Arrays and maps are never shared.** Using a whole local array for the last time moves
    it; otherwise write `copy(x)` when storing it somewhere else or returning a parameter.
    Reading elements (`xs[i]`) and passing arrays to functions is always fine.
11. **`break` and `continue` work in `while` and `for` loops** and act on the innermost loop.
    They are statements only.
12. **Integer overflow stops the program.** When a result may not fit in 64 bits, use
    `checked_add`, `checked_sub` or `checked_mul` from `std/math`; they return `Option[Int]`.
    The smallest Int is written `-9223372036854775808`.
13. **A variable cannot have the name of any function**, including standard library functions
    of modules you import (`lines`, `map`, `min`, `sort` ...). The error names the module.
14. **Arrays are not compared with `==`.** Use `equal(a, b)` from `std/arrays`.
15. **Overflow is checked at every step, not just at the end.** `v * 10 + b - 48` can stop the
    program where `v * 10 + (b - 48)` does not. To read digits into an Int, use `parse_int`.
16. **Comments are `//` only.**

## A complete example

```
import "std/strings"

struct Stats { count: Int, total: Int }

// Sum of the numbers in a comma-separated line; entries that are not numbers are skipped.
fn add_up(line: Str) -> Stats
  ensures result.count >= 0
{
  let parts = split(line, ",")
  var count = 0
  var total = 0
  for i in 0..len(parts) {
    match parse_int(trim(parts[i])) {
      Some(value) => {
        count = count + 1
        total = total + value
      }
      None => { }
    }
  }
  return Stats(count: count, total: total)
}

fn main() uses io {
  let s = add_up("4, 8, x, 15")
  print("count", s.count, "total", s.total)
}
```

## Types

| Type | Notes |
|---|---|
| `Int` | 64-bit signed. Literals: `42`, `1_000_000`. Negative: `-5`. |
| `Float` | 64-bit. Literals need a dot: `1.0`, `2.5e-3`. |
| `Bool` | `true`, `false` |
| `Str` | Immutable bytes (UTF-8). `"text"`, escapes `\n \t \" \\`. |
| `[T]` | Array. `[1, 2, 3]`, `xs[i]`, `len(xs)`. Empty: `let xs: [Int] = []`. |
| `Map[K, V]` | Keys are `Int` or `Str`. Empty: `var m: Map[Str, Int] = {}`. |
| struct | `struct Point { x: Int, y: Int }`, built `Point(x: 1, y: 2)`, read `p.x`. Immutable. |
| enum | `enum Shape { Circle(r: Int), Empty }`, built `Circle(r: 2)` or bare `Empty`. |

Only `Int`, `Float`, `Bool` and `Str` can be compared with `==` and `!=`. `<`, `<=`, `>`, `>=`
work on `Int`, `Float` and `Str` (byte order). Arrays, maps, structs and enums cannot be
compared directly: compare their fields or elements.

## Statements

```
let a = 1                      // immutable
var b = 2                      // mutable
let c: Float = 1.0             // type is optional except for empty [] and {}
b = b + a
xs[0] = 5                      // xs must be a var or a mut parameter
if a > 0 { ... } else if a == 0 { ... } else { ... }
while b < 10 { b = b + 1 }
for i in 0..n { ... }          // i goes from 0 up to n - 1; i cannot be assigned
match value { Circle(r) => { ... } Empty => { ... } }   // every variant, or an else arm
return x
assert a > 0
```

A `for` loop only counts upward by one over a range. For anything else use `while`.
To loop downward: `var i = n - 1` then `while i >= 0 { ...  i = i - 1 }`.

## Functions

```
fn name(a: Int, b: Str) -> Bool { ... }
fn show(x: Int) uses io { print(x) }                 // no return type: returns nothing
fn half(n: Int) -> Int requires n >= 0 ensures result >= 0 { return n / 2 }
fn first[T](xs: [T]) -> T requires len(xs) > 0 { return copy(xs[0]) }   // generic
fn largest[T: Ord](a: T, b: T) -> T { ... }          // constraints: Ord, Eq, Num
```

`requires` and `ensures` are optional contracts. `result` names the return value inside
`ensures`. Functions may be declared in any order. Recursion is allowed. The program starts at
`fn main()`.

Functions can be passed as arguments, by name or as a lambda `fn(x) => x * 2`
(an expression body only). They cannot be stored in variables or returned.

## Built-in functions

| Function | Meaning |
|---|---|
| `print(a, b, ...)` | Writes the values separated by spaces, then a newline. Needs `uses io`. Prints `Int`, `Float`, `Bool`, `Str` only. |
| `len(x)` | Elements of an array, entries of a map, bytes of a `Str` |
| `array(n, init)` | Array of `n` copies of `init` (`init` must not be an array or map) |
| `[i in a..b: expr]` | Array built from an expression: `[i in 0..n: i * i]` |
| `sum(i in a..b: expr)` | Sum of an `Int` or `Float` expression over a range |
| `push(xs, v)` / `pop(xs)` | Add at / remove from the end; `pop` returns the removed value, which may be ignored. `xs` must be a `var` or `mut` parameter. |
| `copy(x)` | Independent deep copy |
| `str(x)` | Text of an `Int`, `Float` or `Bool` |
| `int(f)` / `float(i)` | Convert. `int` truncates toward zero. |
| `sqrt(f)` | Square root of a `Float` |
| `substr(s, start, end)` | Bytes from `start` up to but not including `end` |
| `byte_at(s, i)` | Byte value 0 to 255 at position `i` (`"a"` is 97, `"A"` 65, `"0"` 48, space 32) |
| `chr(b)` | One-byte string from a byte value: `chr(97)` is `"a"` |
| `put(m, k, v)`, `get(m, k)`, `get_or(m, k, d)`, `has(m, k)`, `remove(m, k)`, `keys(m)` | Maps. `get` fails on a missing key; `keys` is in insertion order. |

There is no string indexing (`s[i]` is an error): use `byte_at` and `substr`. Strings are
joined with `+`. There is no string formatting or interpolation.

## Standard library

`import "std/NAME"` at the top of the file. `Option` and `Result` are always available.

| Module | Functions |
|---|---|
| `std/strings` | `split(s, sep) -> [Str]`, `join(parts, sep)`, `lines(s)`, `trim(s)`, `replace(s, from, to)`, `repeat(s, n)`, `contains(s, sub)`, `index_of(s, sub)` (-1 if absent), `starts_with`, `ends_with`, `parse_int(s) -> Option[Int]` (the whole Int range; `None` if it does not fit) |
| `std/arrays` | `sort(xs)` (in place; Int, Float, Str), `sorted(xs)`, `sort_by(xs, fn(x) => key)`, `reverse(xs)`, `concat(a, b)`, `append(xs, x)`, `index_in(xs, x)`, `max_of(xs)`, `min_of(xs)`, `map(xs, f)`, `filter(xs, f)`, `fold(xs, start, f)`, `each(xs, f)`, `any(xs, f)`, `all(xs, f)`, `count_if(xs, f)`, `find_index(xs, f)`, `equal(a, b)` |
| `std/math` | `min(a, b)`, `max(a, b)`, `clamp(x, lo, hi)`, `abs(i)`, `abs_float(f)`, `pow(base, exp)`, `checked_add(a, b)`, `checked_sub(a, b)`, `checked_mul(a, b)` (each `-> Option[Int]`, `None` on overflow), `int_max()`, `int_min()` |
| always | `enum Option[T] { Some(value: T), None }`, `enum Result[T, E] { Ok(value: T), Err(error: E) }`, `unwrap_or(o, d)`, `is_some(o)`, `value_or(r, d)`, `is_ok(r)` |

Do not define your own function with a name used by a module you import, or by a built-in.

## Patterns

```
// Build a string
var out = ""
for i in 0..len(xs) {
  if i > 0 { out = out + "," }
  out = out + str(xs[i])
}

// Build an array of unknown length
var found: [Int] = []
for i in 0..len(xs) {
  if xs[i] > 0 { push(found, xs[i]) }
}
return found            // returning a local array is fine

// Count things
var seen: Map[Str, Int] = {}
put(seen, word, get_or(seen, word, 0) + 1)

// Walk the characters of a string
for i in 0..len(s) {
  let b = byte_at(s, i)
  if b >= 48 and b <= 57 { digits = digits + 1 }
}

// Stop a search early: return from a helper
fn position(xs: [Int], target: Int) -> Int {
  for i in 0..len(xs) {
    if xs[i] == target { return i }
  }
  return -1
}

// Use an optional value
match parse_int(text) {
  Some(value) => { total = total + value }
  None => { }
}
```

## Checking your work

```
avisoq check file.avq --json     // every error with code, line, column and a hint
avisoq run file.avq --allow io
avisoq test file.avq             // runs test "name" { assert ... } blocks
```

Each diagnostic has a `hint` field that usually states the exact fix. Apply it literally.

| Code | Meaning | Fix |
|---|---|---|
| E0001 | Syntax error | Check for semicolons, `&&`/`||`/`!`, or an operator starting a line |
| E0103 | Name already used | Pick a different variable name |
| E0201 | Type mismatch | Convert explicitly: `float(x)`, `int(x)`, `str(x)` |
| E0204 | Assigning to something immutable | Use `var`, or a `mut` parameter |
| E0205 | Missing return on some path | Add a final `return` |
| E0206 | Expression result unused | Bind it with `let` or remove it |
| E0207 | Empty `[]` or `{}` without a type | Write `let xs: [Int] = []` |
| E0210 | Would share an array or map | Wrap it in `copy(...)` |
| E0301 | Effect not declared | Add `uses io` to the function |
