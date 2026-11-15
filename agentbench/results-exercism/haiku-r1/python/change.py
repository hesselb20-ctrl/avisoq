def change(coins: list[int], target: int) -> list[int]:
    if target < 0:
        raise ValueError("target can't be negative")
    if target == 0:
        return []
    usable = sorted({c for c in coins if c > 0})
    unreachable = target + 1
    best = [0] + [unreachable] * target
    last = [0] * (target + 1)
    for amount in range(1, target + 1):
        for coin in usable:
            if coin > amount:
                break
            candidate = best[amount - coin] + 1
            if candidate < best[amount]:
                best[amount] = candidate
                last[amount] = coin
    if best[target] >= unreachable:
        raise ValueError("can't make target with given coins")
    result = []
    amount = target
    while amount > 0:
        coin = last[amount]
        result.append(coin)
        amount -= coin
    return sorted(result)
