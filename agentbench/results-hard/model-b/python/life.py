def life(cells: list[int], w: int, h: int, steps: int) -> list[int]:
    grid = [1 if v else 0 for v in cells]
    size = w * h
    seen = {}
    t = 0
    while t < steps:
        key = tuple(grid)
        if key in seen:
            period = t - seen[key]
            remaining = (steps - t) % period
            for _ in range(remaining):
                grid = _next(grid, w, h, size)
            return grid
        seen[key] = t
        grid = _next(grid, w, h, size)
        t += 1
    return grid


def _next(grid, w, h, size):
    new = [0] * size
    for r in range(h):
        for c in range(w):
            cnt = 0
            for dr in (-1, 0, 1):
                rr = r + dr
                if rr < 0 or rr >= h:
                    continue
                for dc in (-1, 0, 1):
                    if dr == 0 and dc == 0:
                        continue
                    cc = c + dc
                    if 0 <= cc < w:
                        cnt += grid[rr * w + cc]
            idx = r * w + c
            if cnt == 3 or (cnt == 2 and grid[idx]):
                new[idx] = 1
    return new
