import sys

_CYC = None


def sheet(cells: str) -> str:
    sys.setrecursionlimit(10000)
    defs = {}
    for part in cells.split(";"):
        if part == "":
            continue
        name, f = part.split("=", 1)
        defs[name] = f
    memo = {}
    busy = set()

    def get(name):
        if name in memo:
            return memo[name]
        if name in busy:
            return _CYC
        if name not in defs:
            return 0
        busy.add(name)
        v = evaluate(defs[name])
        busy.discard(name)
        memo[name] = v
        return v

    def evaluate(f):
        pos = [0]
        n = len(f)

        def expr():
            v = term()
            while pos[0] < n and f[pos[0]] in "+-":
                op = f[pos[0]]
                pos[0] += 1
                w = term()
                if v is _CYC or w is _CYC:
                    v = _CYC
                else:
                    v = v + w if op == "+" else v - w
            return v

        def term():
            v = unary()
            while pos[0] < n and f[pos[0]] == "*":
                pos[0] += 1
                w = unary()
                v = _CYC if (v is _CYC or w is _CYC) else v * w
            return v

        def unary():
            if f[pos[0]] == "-":
                pos[0] += 1
                v = unary()
                return _CYC if v is _CYC else -v
            if f[pos[0]] == "(":
                pos[0] += 1
                v = expr()
                pos[0] += 1
                return v
            if f[pos[0]] in "0123456789":
                i = pos[0]
                while i < n and f[i] in "0123456789":
                    i += 1
                v = int(f[pos[0]:i])
                pos[0] = i
                return v
            name = f[pos[0]:pos[0] + 2]
            pos[0] += 2
            return get(name)

        return expr()

    out = []
    for name in sorted(defs):
        v = get(name)
        out.append(name + "=" + ("#CYCLE" if v is _CYC else str(v)))
    return ",".join(out)
