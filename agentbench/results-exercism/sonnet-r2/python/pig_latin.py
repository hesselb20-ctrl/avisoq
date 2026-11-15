_V = "aeiou"


def _word(w):
    if w[0] in _V or w.startswith("xr") or w.startswith("yt"):
        return w + "ay"
    i = 0
    while i < len(w) and w[i] not in _V:
        if w[i] == "q" and i + 1 < len(w) and w[i + 1] == "u":
            i += 2
            break
        if w[i] == "y" and i > 0:
            break
        i += 1
    return w[i:] + w[:i] + "ay"


def pig_latin(phrase: str) -> str:
    return " ".join(_word(w) for w in phrase.split())
