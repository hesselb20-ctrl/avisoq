import re

_OPS = {
    "plus": lambda a, b: a + b,
    "minus": lambda a, b: a - b,
    "multiplied by": lambda a, b: a * b,
    "divided by": lambda a, b: a // b if a % b == 0 else int(a / b),
}


def _num(tok):
    if re.fullmatch(r"[+-]?\d+", tok):
        return int(tok)
    return None


def wordy(question: str) -> int:
    m = re.fullmatch(r"What is(.*)\?", question.strip())
    if not m:
        raise ValueError("unknown operation")
    tokens = m.group(1).split()
    if not tokens:
        raise ValueError("syntax error")
    merged = []
    i = 0
    while i < len(tokens):
        if tokens[i] in ("multiplied", "divided") and i + 1 < len(tokens) and tokens[i + 1] == "by":
            merged.append(tokens[i] + " by")
            i += 2
        else:
            merged.append(tokens[i])
            i += 1

    result = _num(merged[0])
    if result is None:
        if merged[0] in _OPS:
            raise ValueError("syntax error")
        raise ValueError("unknown operation")
    i = 1
    while i < len(merged):
        op = merged[i]
        if op not in _OPS:
            if _num(op) is not None:
                raise ValueError("syntax error")
            raise ValueError("unknown operation")
        if i + 1 >= len(merged):
            raise ValueError("syntax error")
        n = _num(merged[i + 1])
        if n is None:
            raise ValueError("syntax error")
        result = _OPS[op](result, n)
        i += 2
    return result
