def life(cells: list[int], w: int, h: int, steps: int) -> list[int]:
    g = [list(cells[r * w:(r + 1) * w]) for r in range(h)]
    for _ in range(steps):
        ng = [[0] * w for _ in range(h)]
        for r in range(h):
            for c in range(w):
                k = 0
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        if dr or dc:
                            rr, cc = r + dr, c + dc
                            if 0 <= rr < h and 0 <= cc < w and g[rr][cc]:
                                k += 1
                ng[r][c] = 1 if (k == 3 or (k == 2 and g[r][c])) else 0
        g = ng
    return [v for row in g for v in row]
