def change(coins: list[int], target: int) -> list[int]:
    if target < 0:
        raise ValueError("can't make target with given coins")
    INF = float("inf")
    best = [0] + [INF] * target
    prev = [0] * (target + 1)
    for t in range(1, target + 1):
        for c in coins:
            if 0 < c <= t and best[t - c] + 1 < best[t]:
                best[t] = best[t - c] + 1
                prev[t] = c
    if best[target] == INF:
        raise ValueError("can't make target with given coins")
    out = []
    t = target
    while t > 0:
        out.append(prev[t])
        t -= prev[t]
    return sorted(out)
