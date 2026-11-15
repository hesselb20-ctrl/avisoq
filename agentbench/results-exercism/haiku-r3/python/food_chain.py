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

_LAST_LINE = "I don't know why she swallowed the fly. Perhaps she'll die."


def _verse(index: int) -> list[str]:
    name, comment = _ANIMALS[index]
    if name == "horse":
        return [
            "I know an old lady who swallowed a horse.",
            "She's dead, of course!",
        ]
    lines = [f"I know an old lady who swallowed a {name}."]
    if comment is not None:
        lines.append(comment)
    for i in range(index, 0, -1):
        predator = _ANIMALS[i][0]
        prey = _ANIMALS[i - 1][0]
        text = f"She swallowed the {predator} to catch the {prey}"
        if prey == "spider":
            text += " that wriggled and jiggled and tickled inside her"
        lines.append(text + ".")
    lines.append(_LAST_LINE)
    return lines


def food_chain(start_verse: int, end_verse: int) -> list[str]:
    result = []
    for verse_number in range(start_verse, end_verse + 1):
        if result:
            result.append("")
        result.extend(_verse(verse_number - 1))
    return result
