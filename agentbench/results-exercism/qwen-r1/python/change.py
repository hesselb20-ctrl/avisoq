def change(coins: list[int], target: int) -> list[int]:
    if target < 0:
        raise ValueError("target must be non-negative")

    if target == 0:
        return []

    valid_coins = sorted({coin for coin in coins if coin > 0})
    if not valid_coins:
        raise ValueError("no valid coins")

    if target % valid_coins[0] != 0:
        raise ValueError("cannot make change")

    inf = target + 1
    dp = [inf] * (target + 1)
    dp[0] = 0
    parent = [-1] * (target + 1)

    for amount in range(1, target + 1):
        for coin in valid_coins:
            if coin > amount:
                break
            if dp[amount - coin] + 1 < dp[amount]:
                dp[amount] = dp[amount - coin] + 1
                parent[amount] = coin

    if dp[target] == inf:
        raise ValueError("cannot make change")

    result = []
    amount = target
    while amount:
        coin = parent[amount]
        result.append(coin)
        amount -= coin

    result.sort()
    return result
