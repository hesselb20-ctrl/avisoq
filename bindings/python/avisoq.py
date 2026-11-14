"""Use Avisoq code from Python.

    import avisoq

    scoring = avisoq.load("scoring.avq")          # compiles the file, runs it sandboxed
    scoring.score([3, 5, 8], 10)                  # calls fn score(xs: [Int], limit: Int) -> Int
    scoring.close()

or, closing it for you:

    with avisoq.load("scoring.avq", allow=["io"]) as scoring:
        print(scoring.summarise([1, 2, 4], "week"))

Values cross the boundary as JSON: Int, Float, Bool, Str, arrays as lists, tuples as lists,
structs as dicts, enums as {"variant": "Name", ...fields}. An Int too large for a JSON number
comes back as a Python int all the same.

This file has no dependencies. It starts `avisoq serve <file>` (Node must be installed) and
talks to it over a pipe, so a call costs a fraction of a millisecond plus the work itself.
The Avisoq code can only do what `allow` grants: by default it cannot print, read files or use
the network.
"""
import json
import os
import shutil
import subprocess

__all__ = ["load", "Module", "AvisoqError"]


class AvisoqError(Exception):
    """A compile error, a bad argument, or a failure inside the Avisoq code (see .kind)."""

    def __init__(self, message, kind="error", details=None):
        super().__init__(message)
        self.kind = kind
        self.details = details or {}


def _command():
    """How to start the Avisoq command line: AVISOQ_CLI, a checkout next to this file, or PATH."""
    explicit = os.environ.get("AVISOQ_CLI")
    if explicit:
        return ["node", explicit] if explicit.endswith(".mjs") else [explicit]
    here = os.path.dirname(os.path.abspath(__file__))
    local = os.path.normpath(os.path.join(here, "..", "..", "src", "cli.mjs"))
    if os.path.exists(local):
        return ["node", local]
    found = shutil.which("avisoq")
    if found:
        return [found]
    raise AvisoqError("cannot find Avisoq: install it with `npm install -g avisoq` or set AVISOQ_CLI", "setup")


def _exact(value):
    """JSON numbers lose precision above 2**53, so larger ints travel as strings."""
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and abs(value) > 2 ** 53:
        return str(value)
    if isinstance(value, (list, tuple)):
        return [_exact(v) for v in value]
    if isinstance(value, dict):
        return {k: _exact(v) for k, v in value.items()}
    return value


class Module:
    """The functions of one Avisoq file. Each callable function is an attribute."""

    def __init__(self, path, allow=()):
        command = _command() + ["serve", path]
        if allow:
            command += ["--allow", ",".join(allow)]
        self._next = 0
        self.output = ""
        self._process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8",
                                         shell=command[0].lower().endswith((".cmd", ".bat")))
        first = self._read()
        if not first.get("ready"):
            self.close()
            error = first.get("error", {})
            raise AvisoqError(error.get("message", "could not load " + path), error.get("kind", "compile"), error)
        self.functions = {f["name"]: f for f in first["functions"]}

    def _read(self):
        line = self._process.stdout.readline()
        if not line:
            raise AvisoqError("the Avisoq process ended unexpectedly", "process")
        return json.loads(line)

    def call(self, name, *args):
        if self._process is None:
            raise AvisoqError("this module was closed", "closed")
        self._next += 1
        self._process.stdin.write(json.dumps({"id": self._next, "fn": name, "args": [_exact(a) for a in args]}) + "\n")
        self._process.stdin.flush()
        answer = self._read()
        self.output = answer.get("output", "")
        if not answer.get("ok"):
            error = answer.get("error", {})
            raise AvisoqError(error.get("message", "call failed"), error.get("kind", "error"), error)
        return self._convert(answer.get("result"), self.functions[name]["ret"])

    def _convert(self, value, ty):
        """Ints that did not fit a JSON number arrive as strings: turn them back into ints."""
        if ty == "Int" and isinstance(value, str):
            return int(value)
        if ty.startswith("[") and isinstance(value, list):
            return [self._convert(v, ty[1:-1]) for v in value]
        return value

    def __getattr__(self, name):
        if name.startswith("_") or name not in self.__dict__.get("functions", {}):
            raise AttributeError(name)
        return lambda *args: self.call(name, *args)

    def close(self):
        process, self._process = self._process, None
        if process is not None:
            try:
                process.stdin.close()
                process.wait(timeout=5)
            except Exception:
                process.kill()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def __del__(self):
        self.close()


def load(path, allow=()):
    """Compile an Avisoq file and return its functions. `allow` lists capabilities, e.g. ["io"]."""
    return Module(path, allow)
