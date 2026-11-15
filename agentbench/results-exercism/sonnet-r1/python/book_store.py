from functools import lru_cache

_PRICE = {0: 0, 1: 800, 2: 1520, 3: 2160, 4: 2560, 5: 3000}


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
        for k in range(1, len(state) + 1):
            new = list(state)
            for i in range(k):
                new[i] -= 1
            nxt = tuple(sorted((x for x in new if x > 0), reverse=True))
            cost = _PRICE[k] + best(nxt)
            if res is None or cost < res:
                res = cost
        return res

    return best(start)
