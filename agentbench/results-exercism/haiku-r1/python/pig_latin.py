_VOWELS = "aeiou"


def _translate(word: str) -> str:
    if not word:
        return word
    lower = word.lower()
    if lower[0] in _VOWELS or lower.startswith(("xr", "yt")):
        return word + "ay"
    split = len(word)
    for i, ch in enumerate(lower):
        if ch == "u" and i > 0 and lower[i - 1] == "q":
            split = i + 1
            break
        if ch in _VOWELS:
            split = i
            break
        if ch == "y" and i > 0:
            split = i
            break
    return word[split:] + word[:split] + "ay"


def pig_latin(phrase: str) -> str:
    return " ".join(_translate(word) for word in phrase.split(" "))
