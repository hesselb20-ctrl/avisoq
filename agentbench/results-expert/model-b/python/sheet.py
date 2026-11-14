import sys


class _Cyc(Exception):
    pass


_CYC = object()


def _tokenize(f):
    toks = []
    i = 0
    n = len(f)
    while i < n:
        c = f[i]
        if c in '+-*()':
            toks.append(c)
            i += 1
        elif '0' <= c <= '9':
            j = i
            while j < n and '0' <= f[j] <= '9':
                j += 1
            toks.append(('n', int(f[i:j])))
            i = j
        elif 'A' <= c <= 'Z':
            toks.append(('c', f[i:i + 2]))
            i += 2
        else:
            i += 1
    return toks


def _parse(toks):
    pos = [0]

    def peek():
        return toks[pos[0]] if pos[0] < len(toks) else None

    def take():
        tok = toks[pos[0]]
        pos[0] += 1
        return tok

    def expr():
        left = term()
        while peek() in ('+', '-'):
            op = take()
            right = term()
            left = ('bin', op, left, right)
        return left

    def term():
        left = unary()
        while peek() == '*':
            take()
            right = unary()
            left = ('bin', '*', left, right)
        return left

    def unary():
        if peek() == '-':
            take()
            return ('neg', unary())
        return atom()

    def atom():
        tok = take()
        if tok == '(':
            e = expr()
            take()  # ')'
            return e
        if tok[0] == 'n':
            return ('num', tok[1])
        return ('ref', tok[1])

    return expr()


def sheet(cells: str) -> str:
    if cells == '':
        return ''
    assigns = {}
    for part in cells.split(';'):
        if part == '':
            continue
        name, formula = part.split('=', 1)
        assigns[name] = _parse(_tokenize(formula))

    memo = {}
    stack = set()

    def ev(node):
        k = node[0]
        if k == 'num':
            return node[1]
        if k == 'ref':
            v = cell(node[1])
            if v is _CYC:
                raise _Cyc()
            return v
        if k == 'neg':
            return -ev(node[1])
        a = ev(node[2])
        b = ev(node[3])
        if node[1] == '+':
            return a + b
        if node[1] == '-':
            return a - b
        return a * b

    def cell(name):
        if name not in assigns:
            return 0
        if name in memo:
            return memo[name]
        if name in stack:
            return _CYC
        stack.add(name)
        try:
            r = ev(assigns[name])
        except _Cyc:
            r = _CYC
        finally:
            stack.discard(name)
        memo[name] = r
        return r

    old = sys.getrecursionlimit()
    if old < 20000:
        sys.setrecursionlimit(20000)
    try:
        parts = []
        for name in sorted(assigns):
            v = cell(name)
            parts.append('%s=%s' % (name, '#CYCLE' if v is _CYC else v))
    finally:
        sys.setrecursionlimit(old)
    return ','.join(parts)
