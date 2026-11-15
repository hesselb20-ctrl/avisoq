_LETTER_VALUES = {}
for _letters, _value in [
    ("AEIOULNRST", 1),
    ("DG", 2),
    ("BCMP", 3),
    ("FHVWY", 4),
    ("K", 5),
    ("JX", 8),
    ("QZ", 10),
]:
    for _ch in _letters:
        _LETTER_VALUES[_ch] = _value


def scrabble_score(word: str) -> int:
    return sum(_LETTER_VALUES.get(ch, 0) for ch in word.upper())
