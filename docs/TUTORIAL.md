# Avisoq tutorial

This walks through the language in about fifteen minutes. Every program here is run by the
test suite (`node tests/docs.mjs`), and the output shown is what it prints.

Install with `npm install -g avisoq` (Node 22 or newer), or use `node src/cli.mjs` from a clone
in place of `avisoq`.

## 1. A first program

```avisoq
fn main() uses io {
  print("Hello,", "world")
}
```

```output
Hello, world
```

Save it as `hello.avq` and run it:

```
avisoq run hello.avq --allow io
```

Two things are already different from most languages. The function says `uses io`: it has a
side effect, printing, and has to declare it. And you had to pass `--allow io`: a program gets
no capability you did not grant. Without the flag it refuses to start.

There are no semicolons. One statement goes on each line.

## 2. Values, variables and functions

```avisoq
fn area(width: Int, height: Int) -> Int {
  return width * height
}

fn main() uses io {
  let name = "rectangle"
  var total = 0
  total += area(3, 4)
  total += area(2, 5)
  let average = float(total) / 2.0
  print(name, total, average, total > 20)
}
```

```output
rectangle 22 11.0 true
```

- `let` never changes; `var` can. Types are worked out for you (`let name: Str = "x"` if you
  want to say it).
- The basic types are `Int` (64-bit), `Float`, `Bool` and `Str`. They never convert on their
  own: `float(total)` and `int(x)` do it explicitly.
- Every path of a function that returns a value must end in `return`.

## 3. Choices and loops

```avisoq
fn describe(n: Int) -> Str {
  if n < 0 {
    return "negative"
  } else if n == 0 {
    return "zero"
  }
  return if n % 2 == 0 then "even" else "odd"
}

fn main() uses io {
  for i in 0..3 {
    print(i, describe(i))
  }
  var n = 27
  var steps = 0
  while n != 1 {
    n = if n % 2 == 0 then n / 2 else 3 * n + 1
    steps += 1
    if steps > 1000 { break }
  }
  print("steps:", steps)
}
```

```output
0 zero
1 odd
2 even
steps: 111
```

`for i in a..b` counts from `a` up to, not including, `b`. Conditions have no brackets and
blocks always have braces. Logic is written `and`, `or`, `not`.

## 4. Arrays, strings and maps

```avisoq
import "std/strings"
import "std/arrays"

fn main() uses io {
  var scores = [70, 95, 82]
  push(scores, 64)
  sort(scores)
  var total = 0
  for s in scores { total += s }
  print(len(scores), scores[0], scores[len(scores) - 1], total)

  let words = split("the quick brown fox", " ")
  var longest = ""
  for w in words {
    if len(w) > len(longest) { longest = w }
  }
  print(longest, to_upper(longest), longest[0] == 'q', join(words, "-"))

  var count: Map[Str, Int] = {}
  for b in "banana" {
    let letter = chr(b)
    put(count, letter, get_or(count, letter, 0) + 1)
  }
  print(get(count, "a"), get(count, "n"), has(count, "z"))
}
```

```output
4 64 95 311
quick QUICK true the-quick-brown-fox
3 2 false
```

- `for x in items` visits every element of an array; over a string it gives each byte as an
  `Int`. A character literal such as `'q'` is that same kind of number.
- An empty array or map needs its type from somewhere: `var count: Map[Str, Int] = {}`.
- The standard library is imported by module. `std/strings` and `std/arrays` are the two you
  will use most; the full list is in the [reference](REFERENCE.md).

Reading past the end of an array, or a key that is not in a map, stops the program with a
message that says where. It never returns garbage.

## 5. Your own types

```avisoq
struct Point { x: Int, y: Int }

enum Shape { Circle(centre: Point, radius: Int), Box(corner: Point, width: Int, height: Int), Empty }

fn area(s: Shape) -> Int {
  match s {
    Circle(centre, radius) => { return 3 * radius * radius }
    Box(corner, width, height) => { return width * height }
    Empty => { return 0 }
  }
}

fn main() uses io {
  var p = Point(x: 1, y: 2)
  p.x += 10
  let shapes = [Circle(centre: p, radius: 2), Box(corner: Point(x: 0, y: 0), width: 3, height: 4), Empty]
  var total = 0
  for s in shapes { total += area(s) }
  print(p.x, p.y, total)
}
```

```output
11 2 24
```

A struct is built with its field names. A `match` must cover every variant: add a variant to
`Shape` and this program stops compiling until `area` handles it.

## 6. Failures are values

There is no `null` and there are no exceptions. Something that may be absent is an `Option`;
something that may fail is a `Result`. Both are ordinary enums and you `match` on them.

```avisoq
import "std/strings"

fn parse_age(text: Str) -> Result[Int, Str] {
  match parse_int(trim(text)) {
    None => { return Err(error: "not a number: " + text) }
    Some(value) => {
      if value < 0 or value > 150 { return Err(error: "out of range: " + str(value)) }
      return Ok(value: value)
    }
  }
}

// The ? passes an Err straight up to the caller, and otherwise gives the value.
fn total_age(a: Str, b: Str) -> Result[Int, Str] {
  let first = parse_age(a)?
  let second = parse_age(b)?
  return Ok(value: first + second)
}

fn show(r: Result[Int, Str]) -> Str {
  match r {
    Ok(value) => { return "ok " + str(value) }
    Err(error) => { return "error: " + error }
  }
}

fn main() uses io {
  print(show(total_age("31", " 42 ")))
  print(show(total_age("31", "old")))
  print(show(total_age("200", "1")))
  print(unwrap_or(parse_int("x"), -1))
}
```

```output
ok 73
error: not a number: old
error: out of range: 200
-1
```

## 7. Saying what a function needs and promises

```avisoq
fn average(xs: [Int]) -> Int
  requires len(xs) > 0
  ensures result >= 0 or result < 0
{
  var total = 0
  for x in xs { total += x }
  return total / len(xs)
}

fn main() uses io {
  print(average([4, 8, 9]))
}
```

```output
7
```

`requires` is what the caller must guarantee, `ensures` is what the function guarantees back.
The compiler proves the ones it can. Call `average([])` and the program does not compile:
the compiler can see the array is empty. When it cannot tell either way, the check runs when
the program does.

## 8. Changing things, and who owns them

```avisoq
struct Counter { name: Str, hits: Int, seen: [Str] }

fn record(c: mut Counter, who: Str) {
  c.hits += 1
  push(c.seen, who)
}

fn fill(xs: mut [Int], value: Int) {
  for i in 0..len(xs) { xs[i] = value }
}

fn main() uses io {
  var c = Counter(name: "visits", hits: 0, seen: [])
  record(c, "ada")
  record(c, "grace")
  var grid = array(3, 0)
  fill(grid, 7)
  let snapshot = copy(grid)
  grid[0] = 1
  print(c.hits, c.seen[1], grid[0], snapshot[0])
}
```

```output
2 grace 1 7
```

- A function can only change an argument it takes as `mut`, and the caller has to pass a `var`.
- Arrays and maps are never shared. `let snapshot = grid` would be refused while `grid` is
  still in use; `copy(grid)` makes an independent value. When a value is used for the last
  time it simply moves, with no copy.

This is what makes two things possible at once: no garbage collector, and no way to write a
data race or a use after free.

## 9. Tests

```avisoq
fn clamp_to(n: Int, low: Int, high: Int) -> Int
  requires low <= high
{
  if n < low { return low }
  if n > high { return high }
  return n
}

test "values inside the range are kept" {
  assert clamp_to(5, 0, 10) == 5
}

test "values outside are pulled in" {
  assert clamp_to(-3, 0, 10) == 0
  assert clamp_to(99, 0, 10) == 10
}

fn main() uses io {
  print(clamp_to(42, 0, 10))
}
```

```output
10
```

`avisoq test file.avq` runs every `test` block, each in isolation.

## 10. The tools

```
avisoq check file.avq          # types, effects and contracts, without running
avisoq run file.avq --allow io # run in the WebAssembly sandbox
avisoq run file.avq --allow io --native   # compile to machine code (needs GCC)
avisoq test file.avq
avisoq fmt file.avq            # the one canonical layout
avisoq build file.avq --native -o program.exe
```

Every error has a code, a position and usually a hint with the fix. Add `--json` to get them
in a form a program can read.

## Where next

- [Language reference](REFERENCE.md): every construct and every library function.
- [Using Avisoq from JavaScript and Python](../examples/embed/README.md).
- [Using installed programs and C libraries from Avisoq](../examples/interop).
- [The one-page guide written for AI models](AGENT_GUIDE.md).
- The README's "Known limits": Avisoq is days old and has only been run on Windows.
