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
   map or struct argument, the parameter must be `mut`: `fn fill(xs: mut [Int])`.
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
13. **A variable may have the same name as a function** (`let lines = split(text, "\n")`,
    `var sum = 0`, `let keys = ...`). It may not have the name of a type, a variant or a constant.
14. **`==` and `!=` work on arrays of `Int`, `Float`, `Bool` and `Str`**, and `xs == []` asks
    whether an array is empty. Other arrays, maps, structs and enums are compared part by part.
15. **Overflow is checked at every step, not just at the end.** `v * 10 + b - '0'` can stop the
    program where `v * 10 + (b - '0')` does not. To read digits into an Int, use `parse_int`.
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

## Shorthand: write it the short way

These forms exist so that programs stay short. Prefer them.

```
for x in items { total += x }            // every element of an array
for i, x in items { print(i, x) }        // with its index
for b in text { if b == ',' { n += 1 } }  // every byte of a Str, as an Int

let c = text[i]                           // a byte of a Str, same as byte_at(text, i)
let word = text[start..end]               // part of a Str, same as substr(text, start, end)
if c >= '0' and c <= '9' { v = v * 10 + (c - '0') }   // 'x' is the Int value of a character

count += 1                                // also -= *= /= %=, on variables, elements and fields
let size = if n > 10 then "big" else "small"   // a conditional expression (not for arrays or maps)
```

- Building a string with `out += piece` in a loop is cheap: a `var` string grows in place.
- A character literal is an `Int`: `'a'` is 97, `'\n'` is 10, `' '` is 32. Never write the number.
- `std/strings` has `is_digit(b)`, `is_letter(b)`, `is_lower(b)`, `is_upper(b)`, `is_space(b)`,
  `pad_left(s, width, "0")` and `pad_right(s, width, " ")` (the fill is a one-character Str).
- In `for x in items`, `x` is a read-only view of the element. To change elements, loop over
  the index: `for i in 0..len(items) { items[i] = ... }`.

## State, constants, tuples and errors

These four features remove most of the bookkeeping from larger programs. Use them.

**Constants.** A top-level `let` is a constant. Its value must be built from literals, operators
and other constants.

```
let MAX_STEPS = 5000
let TOKEN_NUMBER = 1
let TOKEN_NAME = TOKEN_NUMBER + 1
```

**Mutable state: a `var` struct, passed as `mut`.** A field of a `var` struct can be assigned,
and a function can take a struct as a `mut` parameter and change the caller's variable. This is
the way to write a parser or an interpreter: put the position, flags and tables in one struct.

```
struct Parser { src: Str, pos: Int, errors: [Str] }

fn skip_spaces(p: mut Parser) {
  while p.pos < len(p.src) and p.src[p.pos] == ' ' { p.pos += 1 }
}

fn expect(p: mut Parser, ch: Int) {
  skip_spaces(p)
  if p.pos < len(p.src) and p.src[p.pos] == ch {
    p.pos += 1
  } else {
    push(p.errors, "expected " + chr(ch) + " at " + str(p.pos))
  }
}

fn main() uses io {
  var p = Parser(src: " (x", pos: 0, errors: [])
  expect(p, '(')
  expect(p, ')')
  print(p.pos, len(p.errors))
}
```

- The argument for a `mut` struct parameter must be a plain `var` variable or a `mut` parameter.
- `p.pos = v`, `p.a.b = v` and `items[i].count = v` all work. So do `push(p.errors, x)` and
  `pop(p.errors)` as statements, and `put(p.table, k, v)`.
- A struct is still a value: `let saved = p` keeps the old state when `p` changes afterwards.
- `Int`, `Float`, `Bool` and `Str` parameters cannot be `mut`; put them in a struct.

**Tuples.** `(a, b)` builds a tuple of 2 to 4 values, its type is written `(A, B)`, and
`let (x, y) = pair` takes it apart, and `(a, b) = pair` assigns to existing variables. The parts are also `.first`, `.second`, `.third`, `.fourth`.

```
fn divmod(a: Int, b: Int) -> (Int, Int) requires b != 0 {
  return (a / b, a % b)
}

fn main() uses io {
  let (q, r) = divmod(17, 5)
  print(q, r)
}
```

**Passing errors up with `?`.** In a function that returns a `Result`, write `?` at the end of
a `let`, an assignment or a call statement whose value is a `Result`: an `Err` returns from
the function at once, an `Ok` gives its value. The same works for `Option` (a `None` returns
`None`) in a function that returns an `Option`.

```
fn parse_pair(s: Str) -> Result[(Int, Int), Str] {
  let parts = split(s, ",")
  if len(parts) != 2 { return Err(error: "expected two numbers") }
  let a = number(parts[0])?
  let b = number(parts[1])?
  return Ok(value: (a, b))
}

fn number(s: Str) -> Result[Int, Str] {
  match parse_int(trim(s)) {
    Some(value) => { return Ok(value: value) }
    None => { return Err(error: "not a number: " + s) }
  }
}
```

`?` is only allowed at the very end of a statement (`let x = f()?`, `x = f()?`, `f()?`), not
inside a larger expression. The error types must match: the `Err` is passed up unchanged.

## Types

| Type | Notes |
|---|---|
| `Int` | 64-bit signed. Literals: `42`, `1_000_000`. Negative: `-5`. |
| `Float` | 64-bit. Literals need a dot: `1.0`, `2.5e-3`. |
| `Bool` | `true`, `false` |
| `Str` | Immutable bytes (UTF-8). `"text"`, escapes `\n \t \" \\`. |
| `[T]` | Array. `[1, 2, 3]`, `xs[i]`, `len(xs)`. Empty: `let xs: [Int] = []`. |
| `Map[K, V]` | Keys are `Int` or `Str`. Empty: `var m: Map[Str, Int] = {}`. |
| struct | `struct Point { x: Int, y: Int }`, built `Point(x: 1, y: 2)`, read `p.x`. A field of a `var` struct can be assigned: `p.x = 3`. |
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
| `byte_at(s, i)` or `s[i]` | Byte value 0 to 255 at position `i`. Compare with character literals: `s[i] == 'a'` |
| `chr(b)` | One-byte string from a byte value: `chr('a')` is `"a"` |
| `bit_and(a, b)`, `bit_or(a, b)`, `bit_xor(a, b)` | Bitwise operations on `Int` |
| `shift_left(a, n)`, `shift_right(a, n)` | Shifts; `n` must be 0 to 63. `shift_left(1, k)` is 2 to the power k; bit k of x is `bit_and(shift_right(x, k), 1)` |
| `put(m, k, v)`, `get(m, k)`, `get_or(m, k, d)`, `has(m, k)`, `remove(m, k)`, `keys(m)` | Maps. `get` fails on a missing key; `keys` is in insertion order. |

`s[i]` is the byte at position `i` and `s[a..b]` is a substring. Strings are joined with `+`.
There is no string formatting or interpolation.

## Standard library

This table is the whole library: you do not need to read its source files.
`import "std/NAME"` at the top of the file. `Option` and `Result` are always available.

| Module | Functions |
|---|---|
| `std/strings` | `split(s, sep) -> [Str]`, `join(parts, sep)`, `lines(s)`, `trim(s)`, `replace(s, from, to)`, `repeat(s, n)`, `contains(s, sub)`, `index_of(s, sub)` (-1 if absent), `starts_with`, `ends_with`, `parse_int(s) -> Option[Int]` (the whole Int range; `None` if it does not fit), `to_upper(s)`, `to_lower(s)`, `count_of(s, sub)`, `last_index_of(s, sub)`, `reversed(s)`, `matches_at(s, i, sub)`, `matches_glob(pattern, s)` (`*` any run, `?` any one character), `is_digit(b)`, `is_letter(b)`, `is_alnum(b)`, `is_space(b)`, `pad_left(s, width, "0")` |
| `std/arrays` | `sort(xs)` (in place; Int, Float, Str), `sorted(xs)`, `sort_by(xs, fn(x) => key)`, `reverse(xs)`, `concat(a, b)`, `append(xs, x)`, `index_in(xs, x)`, `max_of(xs)`, `min_of(xs)`, `map(xs, f)`, `filter(xs, f)`, `fold(xs, start, f)`, `each(xs, f)`, `any(xs, f)`, `all(xs, f)`, `count_if(xs, f)`, `find_index(xs, f)`, `sum_of(xs, 0)`, `includes(xs, x)`, `last_of(xs)`, `slice(xs, start, end)`, `range(start, end)`, `swap(xs, i, j)`, `unique(xs)` |
| `std/math` | `min(a, b)`, `max(a, b)`, `clamp(x, lo, hi)`, `abs(i)`, `abs_float(f)`, `pow(base, exp)`, `checked_add(a, b)`, `checked_sub(a, b)`, `checked_mul(a, b)` (each `-> Option[Int]`, `None` on overflow), `int_max()`, `int_min()` |
| `std/bigint` | Integers of any size, as the struct `BigInt`. `big("123456789012345678901234567890")`, `big_parse(s) -> Option[BigInt]`, `big_from_int(n)`, `big_str(a)`, `big_to_int(a) -> Option[Int]`, `big_add(a, b)`, `big_sub`, `big_mul`, `big_div` (rounds toward zero), `big_rem` (sign of a), `big_pow(a, n)`, `big_neg`, `big_abs`, `big_cmp(a, b)` (-1, 0, 1), `big_eq`, `big_is_zero`. Use this whenever a number may not fit in 64 bits. |
| always | `equal(a, b)` (what `==` on arrays means), tuples, `enum Option[T] { Some(value: T), None }`, `enum Result[T, E] { Ok(value: T), Err(error: E) }`, `unwrap_or(o, d)`, `is_some(o)`, `value_or(r, d)`, `is_ok(r)` |

You may define a function with the same name as a standard library function: yours is used.
Do not reuse the name of a built-in.

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
  if b >= '0' and b <= '9' { digits += 1 }
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

The fastest loop: put `test "name" { assert ... }` blocks at the bottom of the file you are
writing and run `avisoq test file.avq`. You do not need a `main`, a second file or a copy.
A test can compare whole results: `assert f(3) == [1, 2, 3]`, `assert g("a") == "A"`.


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
