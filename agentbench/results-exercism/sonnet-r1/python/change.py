def change(coins: list[int], target: int) -> list[int]:
    if target < 0:
        raise ValueError("target can't be negative")
    best = [None] * (target + 1)
    best[0] = []
    for t in range(1, target + 1):
        for c in coins:
            if 0 < c <= t and best[t - c] is not None:
                cand = best[t - c]
                if best[t] is None or len(cand) + 1 < len(best[t]):
                    best[t] = cand + [c]
    if best[target] is None:
        raise ValueError("can't make target with given coins")
    return sorted(best[target])
