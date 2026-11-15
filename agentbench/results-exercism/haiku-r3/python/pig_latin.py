_VOWELS = "aeiou"


def _translate_word(word: str) -> str:
    if not word:
        return word
    lower = word.lower()
    # Rule 1: vowel start, or "xr" / "yt"
    if lower[0] in _VOWELS or lower.startswith("xr") or lower.startswith("yt"):
        return word + "ay"

    # length of the leading run of non-vowel letters (y counts as consonant)
    i = 0
    while i < len(lower) and lower[i] not in _VOWELS:
        i += 1

    # Rule 3: consonants followed by "qu"
    if i < len(lower) and lower[i] == "u" and i >= 1 and lower[i - 1] == "q":
        return word[i + 1:] + word[:i + 1] + "ay"

    # Rule 4: consonants followed by "y" (y not at the very start)
    y_index = lower.find("y")
    if 1 <= y_index < i:
        return word[y_index:] + word[:y_index] + "ay"

    # Rule 2: move the leading consonants to the end
    return word[i:] + word[:i] + "ay"


def pig_latin(phrase: str) -> str:
    return " ".join(_translate_word(w) for w in phrase.split(" "))
