_VOWELS = "aeiou"


def _translate_word(word: str) -> str:
    if not word:
        return word
    lower = word.lower()
    # Rule 1: vowel start, or "xr" / "yt".
    if lower[0] in _VOWELS or lower.startswith(("xr", "yt")):
        return word + "ay"

    n = len(word)
    i = 0
    # Rule 2/4: consume consonants; a 'y' after the first letter starts the vowel part.
    while i < n and lower[i] not in _VOWELS and not (i > 0 and lower[i] == "y"):
        i += 1
    # Rule 3: a 'u' right after 'q' belongs to the moved prefix.
    if i < n and lower[i] == "u" and i > 0 and lower[i - 1] == "q":
        i += 1
    return word[i:] + word[:i] + "ay"


def pig_latin(phrase: str) -> str:
    return " ".join(_translate_word(word) for word in phrase.split(" "))
