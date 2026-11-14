from collections import Counter


def most_frequent(xs: list[int]) -> int:
    counts = Counter(xs)
    return max(counts, key=lambda v: (counts[v], -v))
