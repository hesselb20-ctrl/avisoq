def anagram(subject: str, candidates: list[str]) -> list[str]:
    subject_lower = subject.lower()
    subject_sorted = sorted(subject_lower)

    result = []
    for candidate in candidates:
        candidate_lower = candidate.lower()
        if candidate_lower != subject_lower and sorted(candidate_lower) == subject_sorted:
            result.append(candidate)

    return result
