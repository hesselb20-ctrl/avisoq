def eval_expr(s: str) -> str:
    toks = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c.isspace():
            i += 1
        elif c in "0123456789":
            j = i
            while j < n and s[j] in "0123456789":
                j += 1
            toks.append(int(s[i:j]))
            i = j
        else:
            toks.append(c)
            i += 1
    pos = 0
    div0 = False

    def peek():
        return toks[pos] if pos < len(toks) else None

    def unary():
        nonlocal pos
        t = peek()
        if t == '-':
            pos += 1
            return -unary()
        if t == '(':
            pos += 1
            v = expr()
            pos += 1
            return v
        pos += 1
        return t

    def term():
        nonlocal pos, div0
        v = unary()
        while peek() in ('*', '/', '%'):
            op = toks[pos]
            pos += 1
            r = unary()
            if op == '*':
                v = v * r
            elif r == 0:
                div0 = True
                v = 0
            else:
                q = abs(v) // abs(r)
                if (v < 0) != (r < 0):
                    q = -q
                v = q if op == '/' else v - q * r
        return v

    def expr():
        nonlocal pos
        v = term()
        while peek() in ('+', '-'):
            op = toks[pos]
            pos += 1
            r = term()
            v = v + r if op == '+' else v - r
        return v

    v = expr()
    return "div0" if div0 else str(v)
