def anagram(subject: str, candidates: list[str]) -> list[str]:
    s = subject.lower()
    key = sorted(s)
    return [c for c in candidates if c.lower() != s and sorted(c.lower()) == key]
