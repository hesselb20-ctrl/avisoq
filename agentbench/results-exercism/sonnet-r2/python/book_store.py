from functools import lru_cache

_DISCOUNT = {1: 0, 2: 5, 3: 10, 4: 20, 5: 25}


def book_store(basket: list[int]) -> int:
    counts = {}
    for b in basket:
        counts[b] = counts.get(b, 0) + 1
    start = tuple(sorted(counts.values(), reverse=True))

    @lru_cache(maxsize=None)
    def best(state):
        if not state:
            return 0
        res = None
        for k in range(1, min(len(state), 5) + 1):
            nxt = list(state)
            for i in range(k):
                nxt[i] -= 1
            nxt = tuple(sorted((x for x in nxt if x > 0), reverse=True))
            cost = k * 800 * (100 - _DISCOUNT[k]) // 100 + best(nxt)
            if res is None or cost < res:
                res = cost
        return res

    return best(start)
