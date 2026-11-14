_PREC = {'+': 1, '-': 1, '*': 2, '/': 2, '^': 3}
_LEAF = 4


def to_infix(postfix: str) -> str:
    stack = []  # entries: (text, precedence)
    for tok in postfix.split():
        if tok in _PREC:
            rs, rp = stack.pop()
            ls, lp = stack.pop()
            p = _PREC[tok]
            if lp < p or (lp == p and tok == '^'):
                ls = '(' + ls + ')'
            if rp < p or (rp == p and tok in ('-', '/')):
                rs = '(' + rs + ')'
            stack.append((ls + tok + rs, p))
        else:
            stack.append((tok, _LEAF))
    return stack[-1][0]
