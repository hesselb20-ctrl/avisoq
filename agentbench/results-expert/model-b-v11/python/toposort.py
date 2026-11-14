import heapq


def toposort(n: int, edges: list[int]) -> list[int]:
    indeg = [0] * n
    adj = [[] for _ in range(n)]
    for k in range(0, len(edges) - 1, 2):
        a = edges[k]
        b = edges[k + 1]
        adj[a].append(b)
        indeg[b] += 1
    heap = [i for i in range(n) if indeg[i] == 0]
    heapq.heapify(heap)
    order = []
    while heap:
        v = heapq.heappop(heap)
        order.append(v)
        for w in adj[v]:
            indeg[w] -= 1
            if indeg[w] == 0:
                heapq.heappush(heap, w)
    if len(order) < n:
        return [-1]
    return order
