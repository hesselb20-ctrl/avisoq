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

With native=True the file is compiled to machine code and called inside this process:

    scoring = avisoq.load("scoring.avq", native=True)     # needs GCC; several times faster
    scoring = avisoq.open_library("scoring.dll")          # a library built earlier, no Node needed

This file has no dependencies. It starts `avisoq serve <file>` (Node must be installed) and
talks to it over a pipe, so a call costs a fraction of a millisecond plus the work itself.
The Avisoq code can only do what `allow` grants: by default it cannot print, read files or use
the network.
"""
import ctypes
import hashlib
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import threading

__all__ = ["load", "open_library", "Module", "NativeModule", "AvisoqError"]


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


# ---- native: the same functions as machine code, in this process ----

_INT = struct.Struct("<q")
_FLOAT = struct.Struct("<d")


class NativeModule:
    """The functions of a shared library built with `avisoq build file.avq --shared`.

    Calls run as machine code inside this process: no Node, no pipe, no WebAssembly. Anything
    the code prints goes straight to standard output. One call at a time (calls are serialised
    with a lock); recursion deep enough to overflow the stack ends the process.
    """

    def __init__(self, library):
        try:
            self._lib = ctypes.CDLL(os.path.abspath(library))
        except OSError as e:
            raise AvisoqError("%s: cannot be loaded as an Avisoq library (%s)" % (library, e), "setup")
        for name, args in (("avisoq_describe", [ctypes.c_char_p, ctypes.c_int64]), ("avisoq_take", [ctypes.c_char_p, ctypes.c_int64]),
                           ("avisoq_call", [ctypes.c_int32, ctypes.c_char_p, ctypes.c_int64, ctypes.c_char_p, ctypes.c_int64])):
            f = getattr(self._lib, name)
            f.argtypes = args
            f.restype = ctypes.c_int64
        self._lock = threading.Lock()
        self._out = ctypes.create_string_buffer(4096)
        n = self._lib.avisoq_describe(self._out, len(self._out))
        if n > len(self._out):
            self._out = ctypes.create_string_buffer(n)
            self._lib.avisoq_describe(self._out, n)
        about = json.loads(self._out.raw[:n].decode("utf-8"))
        self._structs = about["types"]["structs"]
        self._enums = about["types"]["enums"]
        self._index = {f["name"]: i for i, f in enumerate(about["functions"])}
        self.functions = {f["name"]: f for f in about["functions"]}
        self.output = ""

    def _put(self, out, value, ty, what):
        if ty == "Int":
            if isinstance(value, bool) or not isinstance(value, int) or not -2 ** 63 <= value < 2 ** 63:
                raise AvisoqError("%s: expected an Int (a whole number that fits in 64 bits) but got %r" % (what, value), "argument")
            out += _INT.pack(value)
        elif ty == "Float":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise AvisoqError("%s: expected a Float but got %r" % (what, value), "argument")
            out += _FLOAT.pack(value)
        elif ty == "Bool":
            if not isinstance(value, bool):
                raise AvisoqError("%s: expected a Bool but got %r" % (what, value), "argument")
            out.append(1 if value else 0)
        elif ty == "Str":
            if not isinstance(value, str):
                raise AvisoqError("%s: expected a Str but got %r" % (what, value), "argument")
            data = value.encode("utf-8")
            out += _INT.pack(len(data))
            out += data
        elif ty.startswith("["):
            if not isinstance(value, (list, tuple)):
                raise AvisoqError("%s: expected an array (%s) but got %r" % (what, ty, value), "argument")
            inner = ty[1:-1]
            out += _INT.pack(len(value))
            if inner in ("Int", "Float") and all(type(v) is (int if inner == "Int" else float) for v in value):
                try:
                    out += struct.pack("<%d%s" % (len(value), "q" if inner == "Int" else "d"), *value)
                    return
                except struct.error:
                    pass  # an Int out of range: the slow path names it
            for i, v in enumerate(value):
                self._put(out, v, inner, "%s[%d]" % (what, i))
        elif ty in self._structs:
            fields = self._structs[ty]
            if ty.startswith("Tuple"):
                if not isinstance(value, (list, tuple)) or len(value) != len(fields):
                    raise AvisoqError("%s: expected a tuple of %d but got %r" % (what, len(fields), value), "argument")
                for f, v in zip(fields, value):
                    self._put(out, v, f["ty"], "%s.%s" % (what, f["name"]))
            else:
                if not isinstance(value, dict):
                    raise AvisoqError("%s: expected a dict (%s) but got %r" % (what, ty, value), "argument")
                for f in fields:
                    self._put(out, value.get(f["name"]), f["ty"], "%s.%s" % (what, f["name"]))
        elif ty in self._enums:
            variants = self._enums[ty]
            names = [v["name"] for v in variants]
            if not isinstance(value, dict) or value.get("variant") not in names:
                raise AvisoqError("%s: expected a dict with \"variant\" set to %s (%s) but got %r" % (what, " or ".join(names), ty, value), "argument")
            index = names.index(value["variant"])
            out += _INT.pack(index)
            for f in variants[index]["fields"]:
                self._put(out, value.get(f["name"]), f["ty"], "%s.%s" % (what, f["name"]))
        else:
            raise AvisoqError("%s: values of type %s cannot be passed in" % (what, ty), "argument")

    def _get(self, data, pos, ty):
        if ty == "Int":
            return _INT.unpack_from(data, pos)[0], pos + 8
        if ty == "Float":
            return _FLOAT.unpack_from(data, pos)[0], pos + 8
        if ty == "Bool":
            return data[pos] != 0, pos + 1
        if ty == "Str":
            n = _INT.unpack_from(data, pos)[0]
            return data[pos + 8:pos + 8 + n].decode("utf-8"), pos + 8 + n
        if ty.startswith("["):
            inner = ty[1:-1]
            n = _INT.unpack_from(data, pos)[0]
            pos += 8
            if inner in ("Int", "Float"):
                return list(struct.unpack_from("<%d%s" % (n, "q" if inner == "Int" else "d"), data, pos)), pos + 8 * n
            items = []
            for _ in range(n):
                item, pos = self._get(data, pos, inner)
                items.append(item)
            return items, pos
        if ty in self._structs:
            fields = self._structs[ty]
            values = []
            for f in fields:
                v, pos = self._get(data, pos, f["ty"])
                values.append(v)
            return (values if ty.startswith("Tuple") else {f["name"]: v for f, v in zip(fields, values)}), pos
        variant = self._enums[ty][_INT.unpack_from(data, pos)[0]]
        pos += 8
        value = {"variant": variant["name"]}
        for f in variant["fields"]:
            value[f["name"]], pos = self._get(data, pos, f["ty"])
        return value, pos

    def call(self, name, *args):
        if self._lib is None:
            raise AvisoqError("this module was closed", "closed")
        f = self.functions.get(name)
        if f is None:
            raise AvisoqError("there is no function '%s' to call" % name, "argument")
        if len(args) != len(f["params"]):
            raise AvisoqError("%s takes %d argument(s) (%s) but got %d" % (name, len(f["params"]), ", ".join("%s: %s" % (p["name"], p["ty"]) for p in f["params"]), len(args)), "argument")
        request = bytearray()
        for p, a in zip(f["params"], args):
            self._put(request, a, p["ty"], "%s: argument '%s'" % (name, p["name"]))
        with self._lock:
            r = self._lib.avisoq_call(self._index[name], bytes(request), len(request), self._out, len(self._out))
            n = r if r >= 0 else -1 - r
            if n > len(self._out):
                self._out = ctypes.create_string_buffer(max(n, 2 * len(self._out)))
                self._lib.avisoq_take(self._out, len(self._out))
            data = self._out.raw[:n]
        if r < 0:
            error = json.loads(data.decode("utf-8"))
            if error.get("kind") == "capability_denied":
                error["message"] = "capability '%s' was not granted" % "', '".join(f.get("denied", []))
            raise AvisoqError("%s: %s" % (name, error.get("message", "call failed")), error.get("kind", "error"), error)
        if f["ret"] == "Unit":
            return None
        return self._get(data, 0, f["ret"])[0]

    def __getattr__(self, name):
        if name.startswith("_") or name not in self.__dict__.get("functions", {}):
            raise AttributeError(name)
        return lambda *args: self.call(name, *args)

    def close(self):
        self._lib = None  # the library stays mapped until the process ends

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def open_library(library):
    """Load a shared library built earlier with `avisoq build file.avq --shared -o <library>`."""
    return NativeModule(library)


def load(path, allow=(), native=False):
    """Compile an Avisoq file and return its functions. `allow` lists capabilities, e.g. ["io"].

    native=True compiles to machine code (GCC must be installed) and calls it in this process,
    which is several times faster for real work; the default runs it sandboxed in WebAssembly.
    """
    if not native:
        return Module(path, allow)
    extension = ".dll" if os.name == "nt" else ".dylib" if sys.platform == "darwin" else ".so"
    with open(path, "rb") as f:
        key = hashlib.sha256(f.read() + ",".join(allow).encode("utf-8") + os.path.abspath(path).encode("utf-8")).hexdigest()[:24]
    folder = os.path.join(tempfile.gettempdir(), "avisoq-cache")
    os.makedirs(folder, exist_ok=True)
    library = os.path.join(folder, "py-" + key + extension)
    command = _command() + ["build", path, "--shared", "-o", library, "--json"]
    if allow:
        command += ["--allow", ",".join(allow)]
    done = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", shell=command[0].lower().endswith((".cmd", ".bat")))
    if done.returncode != 0:
        message, details = (done.stdout or done.stderr).strip(), {}
        try:
            details = json.loads(done.stdout)
            first = details["diagnostics"][0]
            message = "%s:%s:%s: error[%s]: %s" % (path, first["line"], first["col"], first["code"], first["message"])
        except Exception:
            pass
        raise AvisoqError(message or "could not build " + path, "compile", details)
    return NativeModule(library)
