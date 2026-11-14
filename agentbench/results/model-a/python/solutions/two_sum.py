from bisect import bisect_right


def two_sum(xs: list[int], target: int) -> list[int]:
    positions = {}
    for idx, x in enumerate(xs):
        positions.setdefault(x, []).append(idx)
    for i, x in enumerate(xs):
        lst = positions.get(target - x)
        if not lst:
            continue
        k = bisect_right(lst, i)
        if k < len(lst):
            return [i, lst[k]]
    return []
