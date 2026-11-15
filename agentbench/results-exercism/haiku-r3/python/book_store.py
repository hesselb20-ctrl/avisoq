from collections import Counter
from functools import lru_cache
from itertools import combinations

_DISCOUNTS = {0: 0, 1: 0, 2: 5, 3: 10, 4: 20, 5: 25}
_BOOK_PRICE = 800  # in cents


def _group_cost(size: int) -> int:
    # size books at (100 - discount)% of 800 cents, kept in whole cents
    return _BOOK_PRICE * size * (100 - _DISCOUNTS[size]) // 100


def book_store(basket: list[int]) -> int:
    counts = Counter(basket)
    state = tuple(sorted((v for v in counts.values() if v > 0), reverse=True))
    if len(state) > 5:
        raise ValueError("only five different books exist")

    @lru_cache(maxsize=None)
    def best(counts_state: tuple) -> int:
        if not counts_state:
            return 0
        n = len(counts_state)
        answer = None
        for size in range(1, n + 1):
            cost_here = _group_cost(size)
            for chosen in combinations(range(n), size):
                new = list(counts_state)
                for idx in chosen:
                    new[idx] -= 1
                key = tuple(sorted((v for v in new if v > 0), reverse=True))
                total = cost_here + best(key)
                if answer is None or total < answer:
                    answer = total
        return answer

    return best(state)
