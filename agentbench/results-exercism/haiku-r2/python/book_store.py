from collections import Counter
from functools import lru_cache

# Price in cents for a group of k different books (8 dollars each, with discount).
_GROUP_PRICE = {1: 800, 2: 1520, 3: 2160, 4: 2560, 5: 3000}


@lru_cache(maxsize=None)
def _best_price(counts: tuple) -> int:
    # counts: non-increasing tuple of positive copy counts, one entry per title.
    if not counts:
        return 0
    n = len(counts)
    best = None
    for mask in range(1, 1 << n):
        chosen = [i for i in range(n) if mask >> i & 1]
        remaining = list(counts)
        for i in chosen:
            remaining[i] -= 1
        remaining_t = tuple(sorted((c for c in remaining if c > 0), reverse=True))
        cost = _GROUP_PRICE[len(chosen)] + _best_price(remaining_t)
        if best is None or cost < best:
            best = cost
    return best


def book_store(basket: list[int]) -> int:
    counts = Counter(basket)
    for title in counts:
        if title not in (1, 2, 3, 4, 5):
            raise ValueError("unknown book")
    key = tuple(sorted(counts.values(), reverse=True))
    return _best_price(key)
