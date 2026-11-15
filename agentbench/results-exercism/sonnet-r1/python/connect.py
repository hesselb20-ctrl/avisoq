def connect(board: list[str]) -> str:
    grid = ["".join(row.split()) for row in board]
    grid = [r for r in grid if r]
    if not grid:
        return ""
    h = len(grid)
    w = max(len(r) for r in grid)
    nbrs = [(0, 1), (0, -1), (1, 0), (-1, 0), (-1, 1), (1, -1)]

    def get(r, c):
        if 0 <= r < h and 0 <= c < len(grid[r]):
            return grid[r][c]
        return None

    def wins(p):
        if p == "X":
            stack = [(r, 0) for r in range(h) if get(r, 0) == "X"]

            def goal(r, c):
                return c == w - 1
        else:
            stack = [(0, c) for c in range(len(grid[0])) if get(0, c) == "O"]

            def goal(r, c):
                return r == h - 1
        seen = set(stack)
        while stack:
            r, c = stack.pop()
            if goal(r, c):
                return True
            for dr, dc in nbrs:
                n = (r + dr, c + dc)
                if n not in seen and get(*n) == p:
                    seen.add(n)
                    stack.append(n)
        return False

    if wins("X"):
        return "X"
    if wins("O"):
        return "O"
    return ""
