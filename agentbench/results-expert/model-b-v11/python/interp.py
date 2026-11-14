def _tokenize(src):
    toks = []
    i = 0
    n = len(src)
    while i < n:
        c = src[i]
        if c == ' ':
            i += 1
            continue
        two = src[i:i + 2]
        if two in ('<=', '>=', '==', '!='):
            toks.append(two)
            i += 2
            continue
        if c in '<>+-*/%()=;{}':
            toks.append(c)
            i += 1
            continue
        if '0' <= c <= '9':
            j = i
            while j < n and '0' <= src[j] <= '9':
                j += 1
            toks.append(src[i:j])
            i = j
            continue
        if 'a' <= c <= 'z':
            j = i
            while j < n and 'a' <= src[j] <= 'z':
                j += 1
            toks.append(src[i:j])
            i = j
            continue
        i += 1
    return toks


class _Parser:
    def __init__(self, toks):
        self.t = toks
        self.i = 0

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def take(self):
        tok = self.t[self.i]
        self.i += 1
        return tok

    def expect(self, s):
        if self.peek() == s:
            self.i += 1

    def stmts(self):
        out = []
        while self.peek() is not None and self.peek() != '}':
            out.append(self.stmt())
        return out

    def stmt(self):
        t = self.peek()
        if t == 'print':
            self.take()
            e = self.expr()
            self.expect(';')
            return ('print', e)
        if t == 'while':
            self.take()
            c = self.expr()
            self.expect('{')
            body = self.stmts()
            self.expect('}')
            return ('while', c, body)
        if t == 'if':
            self.take()
            c = self.expr()
            self.expect('{')
            body = self.stmts()
            self.expect('}')
            other = []
            if self.peek() == 'else':
                self.take()
                self.expect('{')
                other = self.stmts()
                self.expect('}')
            return ('if', c, body, other)
        name = self.take()
        self.expect('=')
        e = self.expr()
        self.expect(';')
        return ('set', name, e)

    def expr(self):
        left = self.sum()
        t = self.peek()
        if t in ('<', '<=', '>', '>=', '==', '!='):
            self.take()
            right = self.sum()
            return ('cmp', t, left, right)
        return left

    def sum(self):
        left = self.term()
        while self.peek() in ('+', '-'):
            op = self.take()
            right = self.term()
            left = ('bin', op, left, right)
        return left

    def term(self):
        left = self.unary()
        while self.peek() in ('*', '/', '%'):
            op = self.take()
            right = self.unary()
            left = ('bin', op, left, right)
        return left

    def unary(self):
        if self.peek() == '-':
            self.take()
            return ('neg', self.unary())
        return self.atom()

    def atom(self):
        t = self.take()
        if t == '(':
            e = self.expr()
            self.expect(')')
            return e
        if '0' <= t[0] <= '9':
            return ('num', int(t))
        return ('var', t)


class _Stop(Exception):
    pass


def _trunc_divmod(a, b):
    q = abs(a) // abs(b)
    if (a < 0) != (b < 0):
        q = -q
    return q, a - b * q


def interp(src: str) -> str:
    prog = _Parser(_tokenize(src)).stmts()
    env = {}
    out = []
    steps = [0]

    def tick():
        steps[0] += 1
        if steps[0] > 5000:
            raise _Stop('!steps')

    def ev(node):
        k = node[0]
        if k == 'num':
            return node[1]
        if k == 'var':
            if node[1] not in env:
                raise _Stop('!undef')
            return env[node[1]]
        if k == 'neg':
            return -ev(node[1])
        if k == 'cmp':
            op = node[1]
            a = ev(node[2])
            b = ev(node[3])
            if op == '<':
                r = a < b
            elif op == '<=':
                r = a <= b
            elif op == '>':
                r = a > b
            elif op == '>=':
                r = a >= b
            elif op == '==':
                r = a == b
            else:
                r = a != b
            return 1 if r else 0
        # binary arithmetic
        op = node[1]
        a = ev(node[2])
        b = ev(node[3])
        if op == '+':
            return a + b
        if op == '-':
            return a - b
        if op == '*':
            return a * b
        if b == 0:
            raise _Stop('!div0')
        q, r = _trunc_divmod(a, b)
        return q if op == '/' else r

    def run(stmts):
        for s in stmts:
            k = s[0]
            if k == 'set':
                tick()
                env[s[1]] = ev(s[2])
            elif k == 'print':
                tick()
                out.append(str(ev(s[1])))
            elif k == 'if':
                tick()
                if ev(s[1]) != 0:
                    run(s[2])
                else:
                    run(s[3])
            else:  # while
                while True:
                    tick()
                    if ev(s[1]) == 0:
                        break
                    run(s[2])

    try:
        run(prog)
    except _Stop as e:
        out.append(str(e))
    return ','.join(out)
