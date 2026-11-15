_ANIMALS = ["fly", "spider", "bird", "cat", "dog", "goat", "cow", "horse"]

_SECOND_LINE = {
    1: "It wriggled and jiggled and tickled inside her.",
    2: "How absurd to swallow a bird!",
    3: "Imagine that, to swallow a cat!",
    4: "What a hog, to swallow a dog!",
    5: "Just opened her throat and swallowed a goat!",
    6: "I don't know how she swallowed a cow!",
}

_DIE_LINE = "I don't know why she swallowed the fly. Perhaps she'll die."


def _verse(index: int) -> list[str]:
    animal = _ANIMALS[index]
    lines = [f"I know an old lady who swallowed a {animal}."]
    if index == len(_ANIMALS) - 1:
        lines.append("She's dead, of course!")
        return lines
    if index in _SECOND_LINE:
        lines.append(_SECOND_LINE[index])
    for j in range(index, 0, -1):
        target = _ANIMALS[j - 1]
        line = f"She swallowed the {_ANIMALS[j]} to catch the {target}."
        if j - 1 == 1:
            line = line[:-1] + " that wriggled and jiggled and tickled inside her."
        lines.append(line)
    lines.append(_DIE_LINE)
    return lines


def food_chain(start_verse: int, end_verse: int) -> list[str]:
    result = []
    for verse_number in range(start_verse, end_verse + 1):
        if result:
            result.append("")
        result.extend(_verse(verse_number - 1))
    return result
