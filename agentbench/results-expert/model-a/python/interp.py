_KW = {"print", "while", "if", "else"}


class _Stop(Exception):
    def __init__(self, name):
        self.name = name


def _tokenize(src):
    toks = []
    i = 0
    n = len(src)
    while i < n:
        c = src[i]
        if c.isspace():
            i += 1
        elif c in "0123456789":
            j = i
            while j < n and src[j] in "0123456789":
                j += 1
            toks.append(("num", int(src[i:j])))
            i = j
        elif "a" <= c <= "z":
            j = i
            while j < n and "a" <= src[j] <= "z":
                j += 1
            w = src[i:j]
            toks.append(("kw" if w in _KW else "name", w))
            i = j
        else:
            two = src[i:i + 2]
            if two in ("<=", ">=", "==", "!="):
                toks.append(("op", two))
                i += 2
            else:
                toks.append(("op", c))
                i += 1
    return toks


class _Parser:
    def __init__(self, toks):
        self.t = toks
        self.p = 0

    def peek(self):
        return self.t[self.p] if self.p < len(self.t) else (None, None)

    def eat(self):
        tok = self.t[self.p]
        self.p += 1
        return tok

    def program(self):
        out = []
        while self.p < len(self.t):
            out.append(self.stmt())
        return out

    def block(self):
        self.eat()  # {
        out = []
        while self.peek() != ("op", "}"):
            out.append(self.stmt())
        self.eat()
        return out

    def stmt(self):
        k, v = self.peek()
        if k == "kw" and v == "print":
            self.eat()
            e = self.expr()
            self.eat()  # ;
            return ("print", e)
        if k == "kw" and v == "while":
            self.eat()
            e = self.expr()
            return ("while", e, self.block())
        if k == "kw" and v == "if":
            self.eat()
            e = self.expr()
            b = self.block()
            eb = []
            if self.peek() == ("kw", "else"):
                self.eat()
                eb = self.block()
            return ("if", e, b, eb)
        name = self.eat()[1]
        self.eat()  # =
        e = self.expr()
        self.eat()
        return ("assign", name, e)

    def expr(self):
        left = self.sum()
        k, v = self.peek()
        if k == "op" and v in ("<", "<=", ">", ">=", "==", "!="):
            self.eat()
            right = self.sum()
            return ("bin", v, left, right)
        return left

    def sum(self):
        left = self.term()
        while True:
            k, v = self.peek()
            if k == "op" and v in ("+", "-"):
                self.eat()
                left = ("bin", v, left, self.term())
            else:
                return left

    def term(self):
        left = self.unary()
        while True:
            k, v = self.peek()
            if k == "op" and v in ("*", "/", "%"):
                self.eat()
                left = ("bin", v, left, self.unary())
            else:
                return left

    def unary(self):
        if self.peek() == ("op", "-"):
            self.eat()
            return ("neg", self.unary())
        k, v = self.eat()
        if k == "num":
            return ("num", v)
        if k == "name":
            return ("var", v)
        e = self.expr()
        self.eat()  # )
        return e


def _ev(e, env):
    t = e[0]
    if t == "num":
        return e[1]
    if t == "var":
        if e[1] not in env:
            raise _Stop("!undef")
        return env[e[1]]
    if t == "neg":
        return -_ev(e[1], env)
    op = e[1]
    a = _ev(e[2], env)
    b = _ev(e[3], env)
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op in ("/", "%"):
        if b == 0:
            raise _Stop("!div0")
        q = abs(a) // abs(b)
        if (a < 0) != (b < 0):
            q = -q
        return q if op == "/" else a - q * b
    return int({"<": a < b, "<=": a <= b, ">": a > b, ">=": a >= b,
                "==": a == b, "!=": a != b}[op])


def interp(src: str) -> str:
    prog = _Parser(_tokenize(src)).program()
    env = {}
    out = []
    steps = [0]

    def step():
        steps[0] += 1
        if steps[0] > 5000:
            raise _Stop("!steps")

    def run(stmts):
        for s in stmts:
            t = s[0]
            if t == "assign":
                step()
                env[s[1]] = _ev(s[2], env)
            elif t == "print":
                step()
                out.append(str(_ev(s[1], env)))
            elif t == "if":
                step()
                if _ev(s[1], env) != 0:
                    run(s[2])
                else:
                    run(s[3])
            else:
                while True:
                    step()
                    if _ev(s[1], env) == 0:
                        break
                    run(s[2])

    try:
        run(prog)
    except _Stop as e:
        out.append(e.name)
    return ",".join(out)
