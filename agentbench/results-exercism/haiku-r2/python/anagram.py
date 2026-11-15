def anagram(subject: str, candidates: list[str]) -> list[str]:
    base = subject.lower()
    key = sorted(base)
    return [
        candidate
        for candidate in candidates
        if candidate.lower() != base and sorted(candidate.lower()) == key
    ]
