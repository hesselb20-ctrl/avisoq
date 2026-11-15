def anagram(subject: str, candidates: list[str]) -> list[str]:
    base = subject.lower()
    base_key = sorted(base)
    result = []
    for candidate in candidates:
        lowered = candidate.lower()
        if lowered == base:
            continue
        if sorted(lowered) == base_key:
            result.append(candidate)
    return result
