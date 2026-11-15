_VALUES = {}
for _letters, _v in (("AEIOULNRST", 1), ("DG", 2), ("BCMP", 3), ("FHVWY", 4),
                     ("K", 5), ("JX", 8), ("QZ", 10)):
    for _ch in _letters:
        _VALUES[_ch] = _v


def scrabble_score(word: str) -> int:
    return sum(_VALUES.get(ch, 0) for ch in word.upper())
