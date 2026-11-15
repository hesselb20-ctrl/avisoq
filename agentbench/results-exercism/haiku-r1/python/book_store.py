from collections import Counter
from functools import lru_cache

_UNIT_PRICE = 800  # in cents
_DISCOUNT_PERCENT = {1: 0, 2: 5, 3: 10, 4: 20, 5: 25}


def _group_cost(size: int) -> int:
    return _UNIT_PRICE * size * (100 - _DISCOUNT_PERCENT[size]) // 100


@lru_cache(maxsize=None)
def _best_cost(counts: tuple) -> int:
    # counts: copies remaining per title, sorted in descending order, all > 0
    if not counts:
        return 0
    best = None
    for size in range(1, min(5, len(counts)) + 1):
        remaining = list(counts)
        for i in range(size):
            remaining[i] -= 1
        nxt = tuple(sorted((c for c in remaining if c > 0), reverse=True))
        cost = _group_cost(size) + _best_cost(nxt)
        if best is None or cost < best:
            best = cost
    return best


def book_store(basket: list[int]) -> int:
    counts = tuple(sorted(Counter(basket).values(), reverse=True))
    return _best_cost(counts)
