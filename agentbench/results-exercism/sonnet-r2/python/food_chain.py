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
_SPIDER = "spider that wriggled and jiggled and tickled inside her"


def _verse(n):
    animal, line = _ANIMALS[n - 1]
    out = [f"I know an old lady who swallowed a {animal}."]
    if n == 8:
        out.append("She's dead, of course!")
        return out
    if line:
        out.append(line)
    for i in range(n - 1, 0, -1):
        prey = _SPIDER if i == 2 else _ANIMALS[i - 1][0]
        out.append(f"She swallowed the {_ANIMALS[i][0]} to catch the {prey}.")
    out.append("I don't know why she swallowed the fly. Perhaps she'll die.")
    return out


def food_chain(start_verse: int, end_verse: int) -> list[str]:
    out = []
    for n in range(start_verse, end_verse + 1):
        if out:
            out.append("")
        out.extend(_verse(n))
    return out
