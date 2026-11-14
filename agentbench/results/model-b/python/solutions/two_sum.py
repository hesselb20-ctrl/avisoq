import bisect
from collections import defaultdict


def two_sum(xs: list[int], target: int) -> list[int]:
    positions = defaultdict(list)
    for idx, v in enumerate(xs):
        positions[v].append(idx)
    for i, v in enumerate(xs):
        lst = positions.get(target - v)
        if lst:
            k = bisect.bisect_right(lst, i)
            if k < len(lst):
                return [i, lst[k]]
    return []
