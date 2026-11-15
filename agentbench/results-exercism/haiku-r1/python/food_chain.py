_ANIMALS = ["fly", "spider", "bird", "cat", "dog", "goat", "cow", "horse"]

_COMMENTS = {
    "spider": "It wriggled and jiggled and tickled inside her.",
    "bird": "How absurd to swallow a bird!",
    "cat": "Imagine that, to swallow a cat!",
    "dog": "What a hog, to swallow a dog!",
    "goat": "Just opened her throat and swallowed a goat!",
    "cow": "I don't know how she swallowed a cow!",
    "horse": "She's dead, of course!",
}

_FLY_LINE = "I don't know why she swallowed the fly. Perhaps she'll die."


def _verse(index: int) -> list[str]:
    animal = _ANIMALS[index]
    lines = [f"I know an old lady who swallowed a {animal}."]
    if animal == "horse":
        lines.append(_COMMENTS["horse"])
        return lines
    if animal in _COMMENTS:
        lines.append(_COMMENTS[animal])
    for j in range(index, 0, -1):
        line = f"She swallowed the {_ANIMALS[j]} to catch the {_ANIMALS[j - 1]}"
        if j == 2:
            line += " that wriggled and jiggled and tickled inside her"
        lines.append(line + ".")
    lines.append(_FLY_LINE)
    return lines


def food_chain(start_verse: int, end_verse: int) -> list[str]:
    if not (1 <= start_verse <= end_verse <= len(_ANIMALS)):
        raise ValueError("verse numbers out of range")
    lines = []
    for verse in range(start_verse, end_verse + 1):
        lines.extend(_verse(verse - 1))
    return lines
