def _tdiv(a, b):
    q = abs(a) // abs(b)
    return q if (a < 0) == (b < 0) else -q


class _DivZero(Exception):
    pass


def eval_expr(s: str) -> str:
    toks = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == " " or c == "\t" or c == "\n" or c == "\r":
            i += 1
        elif "0" <= c <= "9":
            j = i
            while j < n and "0" <= s[j] <= "9":
                j += 1
            toks.append(int(s[i:j]))
            i = j
        else:
            toks.append(c)
            i += 1

    state = {"pos": 0}

    def peek():
        p = state["pos"]
        return toks[p] if p < len(toks) else None

    def advance():
        state["pos"] += 1

    def parse_expr():
        v = parse_term()
        while peek() in ("+", "-"):
            op = peek()
            advance()
            r = parse_term()
            v = v + r if op == "+" else v - r
        return v

    def parse_term():
        v = parse_unary()
        while peek() in ("*", "/", "%"):
            op = peek()
            advance()
            r = parse_unary()
            if op == "*":
                v = v * r
            else:
                if r == 0:
                    raise _DivZero()
                if op == "/":
                    v = _tdiv(v, r)
                else:
                    v = v - r * _tdiv(v, r)
        return v

    def parse_unary():
        negate = False
        while peek() == "-":
            negate = not negate
            advance()
        v = parse_primary()
        return -v if negate else v

    def parse_primary():
        t = peek()
        if isinstance(t, int):
            advance()
            return t
        if t == "(":
            advance()
            v = parse_expr()
            if peek() == ")":
                advance()
            return v
        raise ValueError("malformed")

    try:
        result = parse_expr()
    except _DivZero:
        return "div0"
    return str(result)
