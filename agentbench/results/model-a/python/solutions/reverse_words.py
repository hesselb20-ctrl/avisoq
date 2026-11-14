def reverse_words(s: str) -> str:
    if s == "":
        return ""
    return " ".join(reversed(s.split(" ")))
