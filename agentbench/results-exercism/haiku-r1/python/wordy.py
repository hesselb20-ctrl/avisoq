import re

_INT_RE = re.compile(r"[+-]?\d+")
_PREFIX = "what is"


def _is_int(token: str) -> bool:
    return _INT_RE.fullmatch(token) is not None


def wordy(question: str) -> int:
    text = question.strip()
    if not text.lower().startswith(_PREFIX):
        raise ValueError("unknown operation")
    body = text[len(_PREFIX):]
    if body.endswith("?"):
        body = body[:-1]
    tokens = body.split()
    if not tokens or not _is_int(tokens[0]):
        raise ValueError("syntax error")

    result = int(tokens[0])
    i = 1
    while i < len(tokens):
        op = tokens[i].lower()
        if op in ("plus", "minus"):
            i += 1
        elif op in ("multiplied", "divided"):
            if i + 1 >= len(tokens) or tokens[i + 1].lower() != "by":
                raise ValueError("syntax error")
            i += 2
        else:
            raise ValueError("unknown operation")
        if i >= len(tokens) or not _is_int(tokens[i]):
            raise ValueError("syntax error")
        operand = int(tokens[i])
        i += 1

        if op == "plus":
            result = result + operand
        elif op == "minus":
            result = result - operand
        elif op == "multiplied":
            result = result * operand
        else:
            if operand == 0:
                raise ValueError("division by zero")
            quotient = abs(result) // abs(operand)
            negative = (result < 0) != (operand < 0)
            result = -quotient if negative else quotient
    return result
