from fractions import Fraction


def _tokenize(s):
    toks = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == ' ':
            i += 1
        elif '0' <= c <= '9':
            j = i
            while j < n and '0' <= s[j] <= '9':
                j += 1
            toks.append(Fraction(int(s[i:j])))
            i = j
        else:
            toks.append(c)
            i += 1
    return toks


def frac_calc(s: str) -> str:
    toks = _tokenize(s)
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
            left = left + right if op == '+' else left - right
        return left

    def term():
        left = unary()
        while peek() in ('*', '/'):
            op = take()
            right = unary()
            if op == '*':
                left = left * right
            else:
                if right == 0:
                    raise ZeroDivisionError()
                left = left / right
        return left

    def unary():
        if peek() == '-':
            take()
            return -unary()
        return atom()

    def atom():
        tok = take()
        if tok == '(':
            e = expr()
            take()  # ')'
            return e
        return tok

    try:
        v = expr()
    except ZeroDivisionError:
        return 'div0'
    if v.denominator == 1:
        return str(v.numerator)
    return '%d/%d' % (v.numerator, v.denominator)
