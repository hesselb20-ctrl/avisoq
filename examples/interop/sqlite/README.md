# SQLite from Avisoq

`notes.avq` uses a real C library, SQLite, through the small binding in `sqlite_shim.c`.

```
avisoq run examples/interop/sqlite/notes.avq --allow io,ffi --native
```

It needs the SQLite library in this folder. On Windows with the WinLibs GCC toolchain that file
already exists as `libsqlite3-0.dll` in the toolchain's `bin` folder: copy it here. (The
`sqlite3.dll` that ships inside Python does not work outside Python: it crashes when called from
plain C as well.) The tests copy the file for you when they find it.

## How it fits together

- `extern "sqlite_shim.c" link "libsqlite3-0.dll" fn db_open(path: Str) -> Int` declares a
  function written in the C file, and names the library file to link.
- Avisoq exchanges only whole numbers, floats, booleans and strings with C. The connection is
  therefore a number on the Avisoq side, and a query result comes back as text (rows on lines,
  columns separated by tabs) that Avisoq splits.
- Values are bound to `?1` and `?2` in C, so text from the program is never pasted into SQL.
- On the Avisoq side each call is wrapped in a function that returns a `Result`, so a failing
  query is a value the program has to handle.

## What this does and does not give you

Calling C needs `--allow ffi`, and such a program runs without Avisoq's reduced-rights
launcher. Inside the C file there are no bounds checks and no overflow checks: a mistake there
can crash the program or corrupt memory, exactly as in any C program. Keep that file small.
