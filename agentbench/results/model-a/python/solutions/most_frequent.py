def most_frequent(xs: list[int]) -> int:
    counts = {}
    for x in xs:
        counts[x] = counts.get(x, 0) + 1
    best = max(counts.values())
    return min(v for v, c in counts.items() if c == best)
