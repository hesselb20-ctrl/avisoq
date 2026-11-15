def _word(w):
    vowels = "aeiou"
    if w[0] in vowels or w.startswith("xr") or w.startswith("yt"):
        return w + "ay"
    i = 0
    while i < len(w):
        if w[i] in vowels:
            if w[i] == "u" and i > 0 and w[i - 1] == "q":
                i += 1
            break
        if w[i] == "y" and i > 0:
            break
        i += 1
    return w[i:] + w[:i] + "ay"


def pig_latin(phrase: str) -> str:
    return " ".join(_word(w) for w in phrase.split() if w)
