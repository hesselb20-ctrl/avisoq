from fractions import Fraction


class _Div0(Exception):
    pass


def frac_calc(s: str) -> str:
    toks = []
    i = 0
    while i < len(s):
        c = s[i]
        if c.isspace():
            i += 1
        elif c in "0123456789":
            j = i
            while j < len(s) and s[j] in "0123456789":
                j += 1
            toks.append(int(s[i:j]))
            i = j
        else:
            toks.append(c)
            i += 1
    pos = [0]

    def peek():
        return toks[pos[0]] if pos[0] < len(toks) else None

    def expr():
        v = term()
        while peek() in ("+", "-"):
            op = toks[pos[0]]
            pos[0] += 1
            w = term()
            v = v + w if op == "+" else v - w
        return v

    def term():
        v = unary()
        while peek() in ("*", "/"):
            op = toks[pos[0]]
            pos[0] += 1
            w = unary()
            if op == "*":
                v = v * w
            else:
                if w == 0:
                    raise _Div0
                v = v / w
        return v

    def unary():
        t = peek()
        pos[0] += 1
        if t == "-":
            return -unary()
        if t == "(":
            v = expr()
            pos[0] += 1
            return v
        return Fraction(t)

    try:
        r = expr()
    except _Div0:
        return "div0"
    if r.denominator == 1:
        return str(r.numerator)
    return "%d/%d" % (r.numerator, r.denominator)
