_VALUES = {}
for _letters, _v in (("AEIOULNRST", 1), ("DG", 2), ("BCMP", 3), ("FHVWY", 4),
                     ("K", 5), ("JX", 8), ("QZ", 10)):
    for _c in _letters:
        _VALUES[_c] = _v


def scrabble_score(word: str) -> int:
    return sum(_VALUES.get(c, 0) for c in word.upper())
