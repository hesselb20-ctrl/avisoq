import re


def _to_int(token: str) -> int:
    if not re.fullmatch(r"-?\d+", token):
        raise ValueError("syntax error")
    return int(token)


def _divide(a: int, b: int) -> int:
    if b == 0:
        raise ValueError("division by zero")
    quotient = abs(a) // abs(b)
    return quotient if (a >= 0) == (b >= 0) else -quotient


def wordy(question: str) -> int:
    text = question.strip()
    prefix = "What is"
    if not text.startswith(prefix) or not text.endswith("?"):
        raise ValueError("unknown operation")
    tokens = text[len(prefix):-1].split()
    if not tokens:
        raise ValueError("syntax error")

    result = _to_int(tokens[0])
    i = 1
    while i < len(tokens):
        token = tokens[i]
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if token == "plus" or token == "minus":
            if nxt is None:
                raise ValueError("syntax error")
            operand = _to_int(nxt)
            result = result + operand if token == "plus" else result - operand
            i += 2
        elif token == "multiplied" and nxt == "by" or token == "divided" and nxt == "by":
            if i + 2 >= len(tokens):
                raise ValueError("syntax error")
            operand = _to_int(tokens[i + 2])
            if token == "multiplied":
                result = result * operand
            else:
                result = _divide(result, operand)
            i += 3
        else:
            raise ValueError("unknown operation")
    return result
