import re

_NUMBER = re.compile(r"^-?\d+$")


def wordy(question: str) -> int:
    match = re.match(r"^\s*What is(?P<body>.*)\?\s*$", question)
    if not match:
        raise ValueError("unknown operation")
    tokens = match.group("body").split()
    if not tokens:
        raise ValueError("syntax error")

    def read_number(index: int) -> int:
        if index >= len(tokens) or not _NUMBER.match(tokens[index]):
            raise ValueError("syntax error")
        return int(tokens[index])

    value = read_number(0)
    i = 1
    while i < len(tokens):
        op = tokens[i]
        if op == "plus":
            value = value + read_number(i + 1)
            i += 2
        elif op == "minus":
            value = value - read_number(i + 1)
            i += 2
        elif op == "multiplied":
            if i + 1 >= len(tokens) or tokens[i + 1] != "by":
                raise ValueError("syntax error")
            value = value * read_number(i + 2)
            i += 3
        elif op == "divided":
            if i + 1 >= len(tokens) or tokens[i + 1] != "by":
                raise ValueError("syntax error")
            divisor = read_number(i + 2)
            if divisor == 0:
                raise ValueError("division by zero")
            quotient = abs(value) // abs(divisor)
            value = quotient if (value >= 0) == (divisor > 0) else -quotient
            i += 3
        else:
            raise ValueError("unknown operation")
    return value
