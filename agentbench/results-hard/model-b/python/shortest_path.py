import heapq


def shortest_path(n: int, edges: list[int]) -> int:
    adj = [[] for _ in range(n)]
    for i in range(0, len(edges) - 2, 3):
        a, b, length = edges[i], edges[i + 1], edges[i + 2]
        adj[a].append((b, length))
        adj[b].append((a, length))
    INF = None
    dist = [INF] * n
    dist[0] = 0
    heap = [(0, 0)]
    while heap:
        d, u = heapq.heappop(heap)
        if d != dist[u]:
            continue
        for v, length in adj[u]:
            nd = d + length
            if dist[v] is None or nd < dist[v]:
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    if n == 1:
        return 0
    return -1 if dist[n - 1] is None else dist[n - 1]
