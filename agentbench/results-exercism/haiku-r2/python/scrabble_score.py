def scrabble_score(word: str) -> int:
    values = {}
    for letters, value in (
        ("AEIOULNRST", 1),
        ("DG", 2),
        ("BCMP", 3),
        ("FHVWY", 4),
        ("K", 5),
        ("JX", 8),
        ("QZ", 10),
    ):
        for letter in letters:
            values[letter] = value
    return sum(values.get(ch, 0) for ch in word.upper())
