class _Err(Exception):
    pass


def json_canon(s: str) -> str:
    n = len(s)
    pos = [0]

    def ws():
        while pos[0] < n and s[pos[0]] == " ":
            pos[0] += 1

    def string():
        i = pos[0]
        if i >= n or s[i] != "'":
            raise _Err
        j = s.find("'", i + 1)
        if j < 0:
            raise _Err
        pos[0] = j + 1
        return s[i + 1:j]

    def value():
        ws()
        if pos[0] >= n:
            raise _Err
        c = s[pos[0]]
        if c == "{":
            pos[0] += 1
            d = {}
            ws()
            if pos[0] < n and s[pos[0]] == "}":
                pos[0] += 1
                return "{}"
            while True:
                ws()
                k = string()
                ws()
                if pos[0] >= n or s[pos[0]] != ":":
                    raise _Err
                pos[0] += 1
                d[k] = value()
                ws()
                if pos[0] >= n:
                    raise _Err
                c2 = s[pos[0]]
                pos[0] += 1
                if c2 == "}":
                    break
                if c2 != ",":
                    raise _Err
            return "{" + ",".join("'" + k + "':" + d[k] for k in sorted(d)) + "}"
        if c == "[":
            pos[0] += 1
            items = []
            ws()
            if pos[0] < n and s[pos[0]] == "]":
                pos[0] += 1
                return "[]"
            while True:
                items.append(value())
                ws()
                if pos[0] >= n:
                    raise _Err
                c2 = s[pos[0]]
                pos[0] += 1
                if c2 == "]":
                    break
                if c2 != ",":
                    raise _Err
            return "[" + ",".join(items) + "]"
        if c == "'":
            return "'" + string() + "'"
        for w in ("true", "false", "null"):
            if s.startswith(w, pos[0]):
                pos[0] += len(w)
                return w
        i = pos[0]
        if i < n and s[i] == "-":
            i += 1
        if i >= n or s[i] not in "0123456789":
            raise _Err
        if s[i] == "0":
            i += 1
        else:
            while i < n and s[i] in "0123456789":
                i += 1
        v = int(s[pos[0]:i])
        pos[0] = i
        return str(v)

    try:
        r = value()
        ws()
        if pos[0] != n:
            return "error"
        return r
    except _Err:
        return "error"
