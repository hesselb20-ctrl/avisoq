def toposort(n: int, edges: list[int]) -> list[int]:
    indeg = [0] * n
    adj = [[] for _ in range(n)]
    for i in range(0, len(edges) - 1, 2):
        a, b = edges[i], edges[i + 1]
        adj[a].append(b)
        indeg[b] += 1
    taken = [False] * n
    order = []
    for _ in range(n):
        v = -1
        for u in range(n):
            if not taken[u] and indeg[u] == 0:
                v = u
                break
        if v < 0:
            return [-1]
        taken[v] = True
        order.append(v)
        for w in adj[v]:
            indeg[w] -= 1
    return order
