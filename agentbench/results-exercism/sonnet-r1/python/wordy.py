import re

_OPS = {
    "plus": lambda a, b: a + b,
    "minus": lambda a, b: a - b,
    "multiplied by": lambda a, b: a * b,
    "divided by": lambda a, b: a // b if a % b == 0 else a / b,
}


def _is_num(t):
    return re.fullmatch(r"[+-]?\d+", t) is not None


def wordy(question: str) -> int:
    q = question.strip()
    m = re.fullmatch(r"What is(.*)\?", q)
    if not m:
        raise ValueError("unknown operation")
    body = m.group(1).strip()
    if not body:
        raise ValueError("syntax error")
    body = body.replace("multiplied by", "multiplied_by").replace("divided by", "divided_by")
    tokens = [t.replace("_", " ") for t in body.split()]

    if not _is_num(tokens[0]):
        if tokens[0] in _OPS:
            raise ValueError("syntax error")
        raise ValueError("unknown operation")
    result = int(tokens[0])
    i = 1
    while i < len(tokens):
        op = tokens[i]
        if op not in _OPS:
            if _is_num(op):
                raise ValueError("syntax error")
            raise ValueError("unknown operation")
        if i + 1 >= len(tokens) or not _is_num(tokens[i + 1]):
            raise ValueError("syntax error")
        b = int(tokens[i + 1])
        if op == "divided by" and b == 0:
            raise ValueError("division by zero")
        result = _OPS[op](result, b)
        i += 2
    return result
