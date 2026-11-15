_ANIMALS = [
    ("fly", None),
    ("spider", "It wriggled and jiggled and tickled inside her."),
    ("bird", "How absurd to swallow a bird!"),
    ("cat", "Imagine that, to swallow a cat!"),
    ("dog", "What a hog, to swallow a dog!"),
    ("goat", "Just opened her throat and swallowed a goat!"),
    ("cow", "I don't know how she swallowed a cow!"),
    ("horse", "She's dead, of course!"),
]


def _verse(n):
    animal, remark = _ANIMALS[n - 1]
    lines = ["I know an old lady who swallowed a " + animal + "."]
    if n == 8:
        lines.append(remark)
        return lines
    if remark:
        lines.append(remark)
    for i in range(n - 1, 0, -1):
        prey = _ANIMALS[i - 1][0]
        pred = _ANIMALS[i][0]
        extra = " that wriggled and jiggled and tickled inside her" if prey == "spider" else ""
        lines.append("She swallowed the " + pred + " to catch the " + prey + extra + ".")
    lines.append("I don't know why she swallowed the fly. Perhaps she'll die.")
    return lines


def food_chain(start_verse: int, end_verse: int) -> list[str]:
    out = []
    for n in range(start_verse, end_verse + 1):
        if out:
            out.append("")
        out.extend(_verse(n))
    return out
