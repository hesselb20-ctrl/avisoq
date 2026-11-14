from collections import OrderedDict


def lru(capacity: int, ops: list[int]) -> list[int]:
    cache = OrderedDict()
    res = []
    i = 0
    while i < len(ops):
        if ops[i] == 0:
            k = ops[i + 1]
            i += 2
            if k in cache:
                cache.move_to_end(k)
                res.append(cache[k])
            else:
                res.append(-1)
        else:
            k, v = ops[i + 1], ops[i + 2]
            i += 3
            cache[k] = v
            cache.move_to_end(k)
            if len(cache) > capacity:
                cache.popitem(last=False)
    return res
