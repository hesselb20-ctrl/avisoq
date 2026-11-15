def _num(t):
    try:
        return int(t)
    except ValueError:
        return None


def wordy(question: str) -> int:
    q = question.strip()
    if not q.startswith("What is"):
        raise ValueError("unknown operation")
    q = q[len("What is"):]
    if q.endswith("?"):
        q = q[:-1]
    raw = q.split()
    if not raw:
        raise ValueError("syntax error")

    ops = {"plus", "minus", "multiplied", "divided"}
    tokens = []
    i = 0
    while i < len(raw):
        t = raw[i]
        if t in ("multiplied", "divided"):
            if i + 1 < len(raw) and raw[i + 1] == "by":
                tokens.append(t)
                i += 2
                continue
            raise ValueError("syntax error")
        tokens.append(t)
        i += 1

    result = _num(tokens[0])
    if result is None:
        if tokens[0] in ops:
            raise ValueError("syntax error")
        raise ValueError("unknown operation")
    i = 1
    while i < len(tokens):
        op = tokens[i]
        if op not in ops:
            if _num(op) is not None:
                raise ValueError("syntax error")
            raise ValueError("unknown operation")
        if i + 1 >= len(tokens):
            raise ValueError("syntax error")
        v = _num(tokens[i + 1])
        if v is None:
            raise ValueError("syntax error")
        if op == "plus":
            result += v
        elif op == "minus":
            result -= v
        elif op == "multiplied":
            result *= v
        else:
            if result % v == 0:
                result //= v
            else:
                result = int(result / v)
        i += 2
    return result
