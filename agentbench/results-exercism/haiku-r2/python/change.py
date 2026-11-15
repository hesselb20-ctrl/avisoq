def change(coins: list[int], target: int) -> list[int]:
    if target < 0:
        raise ValueError("target can't be negative")
    if target == 0:
        return []
    best = [0] + [None] * target
    last = [0] * (target + 1)
    for t in range(1, target + 1):
        for coin in coins:
            if coin <= 0 or coin > t or best[t - coin] is None:
                continue
            candidate = best[t - coin] + 1
            if best[t] is None or candidate < best[t]:
                best[t] = candidate
                last[t] = coin
    if best[target] is None:
        raise ValueError("can't make target with given coins")
    result = []
    remaining = target
    while remaining > 0:
        result.append(last[remaining])
        remaining -= last[remaining]
    return sorted(result)
