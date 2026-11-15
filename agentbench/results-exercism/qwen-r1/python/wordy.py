import re


def wordy(question: str) -> int:
    if not isinstance(question, str):
        raise ValueError("question must be a string")

    text = question.strip()
    if not text.startswith("What is "):
        raise ValueError("not a supported math question")

    if text.endswith("?"):
        text = text[:-1]

    expression = text[len("What is "):].strip()
    if not expression:
        raise ValueError("missing expression")

    tokens = expression.split()
    if not tokens:
        raise ValueError("missing expression")

    number_re = re.compile(r"^-?\d+$")
    ops = {
        "plus": lambda a, b: a + b,
        "minus": lambda a, b: a - b,
        "multiplied": lambda a, b: a * b,
        "divided": lambda a, b: a // b,
    }

    def parse_number(index: int) -> int:
        if index >= len(tokens) or not number_re.match(tokens[index]):
            raise ValueError("invalid number")
        return int(tokens[index])

    def parse_operation(index: int):
        if index >= len(tokens):
            raise ValueError("invalid operation")

        token = tokens[index]
        if token in ("plus", "minus"):
            return ops[token], index + 1
        if token in ("multiplied", "divided"):
            if index + 1 >= len(tokens) or tokens[index + 1] != "by":
                raise ValueError("invalid operation")
            return ops[token], index + 2
        raise ValueError("unsupported operation")

    value = parse_number(0)
    index = 1

    while index < len(tokens):
        operation, index = parse_operation(index)
        value = operation(value, parse_number(index))
        index += 1

    return value
