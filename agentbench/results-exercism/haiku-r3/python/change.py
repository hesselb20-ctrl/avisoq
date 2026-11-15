def change(coins: list[int], target: int) -> list[int]:
    if target < 0:
        raise ValueError("target must be non-negative")
    if target == 0:
        return []
    usable = sorted({c for c in coins if c > 0})
    INF = float("inf")
    best = [INF] * (target + 1)
    last = [0] * (target + 1)
    best[0] = 0
    for amount in range(1, target + 1):
        for coin in usable:
            if coin > amount:
                break
            if best[amount - coin] + 1 < best[amount]:
                best[amount] = best[amount - coin] + 1
                last[amount] = coin
    if best[target] == INF:
        raise ValueError("can't make target with given coins")
    result = []
    amount = target
    while amount > 0:
        coin = last[amount]
        result.append(coin)
        amount -= coin
    return sorted(result)
