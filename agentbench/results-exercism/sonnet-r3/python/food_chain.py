_ANIMALS = [
    ("fly", None),
    ("spider", "It wriggled and jiggled and tickled inside her."),
    ("bird", "How absurd to swallow a bird!"),
    ("cat", "Imagine that, to swallow a cat!"),
    ("dog", "What a hog, to swallow a dog!"),
    ("goat", "Just opened her throat and swallowed a goat!"),
    ("cow", "I don't know how she swallowed a cow!"),
    ("horse", None),
]


def _verse(n: int) -> list[str]:
    animal, remark = _ANIMALS[n - 1]
    lines = [f"I know an old lady who swallowed a {animal}."]
    if n == 8:
        lines.append("She's dead, of course!")
        return lines
    if remark:
        lines.append(remark)
    for i in range(n - 1, 0, -1):
        cur = _ANIMALS[i][0]
        prv = _ANIMALS[i - 1][0]
        line = f"She swallowed the {cur} to catch the {prv}"
        if prv == "spider":
            line += " that wriggled and jiggled and tickled inside her"
        lines.append(line + ".")
    lines.append("I don't know why she swallowed the fly. Perhaps she'll die.")
    return lines


def food_chain(start_verse: int, end_verse: int) -> list[str]:
    out = []
    for n in range(start_verse, end_verse + 1):
        if out:
            out.append("")
        out.extend(_verse(n))
    return out
