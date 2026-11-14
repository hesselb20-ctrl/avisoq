from collections import OrderedDict


def lru(capacity: int, ops: list[int]) -> list[int]:
    cache = OrderedDict()
    results = []
    i = 0
    n = len(ops)
    while i < n:
        if ops[i] == 0:
            key = ops[i + 1]
            i += 2
            if key in cache:
                cache.move_to_end(key)
                results.append(cache[key])
            else:
                results.append(-1)
        else:
            key = ops[i + 1]
            value = ops[i + 2]
            i += 3
            if key in cache:
                cache[key] = value
                cache.move_to_end(key)
            else:
                cache[key] = value
                if len(cache) > capacity:
                    cache.popitem(last=False)
    return results
