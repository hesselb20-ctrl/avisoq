import heapq


def shortest_path(n: int, edges: list[int]) -> int:
    adj = [[] for _ in range(n)]
    for i in range(0, len(edges) - 2, 3):
        a, b, w = edges[i], edges[i + 1], edges[i + 2]
        adj[a].append((b, w))
        adj[b].append((a, w))
    INF = float('inf')
    dist = [INF] * n
    dist[0] = 0
    pq = [(0, 0)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return -1 if dist[n - 1] == INF else dist[n - 1]
