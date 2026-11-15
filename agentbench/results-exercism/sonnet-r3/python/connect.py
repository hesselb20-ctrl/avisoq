def connect(board: list[str]) -> str:
    grid = [row.replace(" ", "") for row in board]
    grid = [r for r in grid if r]
    if not grid:
        return ""
    h = len(grid)

    def wins(player, starts, goal):
        seen = set(starts)
        stack = list(starts)
        while stack:
            r, c = stack.pop()
            if goal(r, c):
                return True
            for dr, dc in ((0, 1), (0, -1), (-1, 0), (-1, 1), (1, 0), (1, -1)):
                nr, nc = r + dr, c + dc
                if (0 <= nr < h and 0 <= nc < len(grid[nr]) and (nr, nc) not in seen
                        and grid[nr][nc] == player):
                    seen.add((nr, nc))
                    stack.append((nr, nc))
        return False

    xs = [(r, 0) for r in range(h) if grid[r][0] == "X"]
    if wins("X", xs, lambda r, c: c == len(grid[r]) - 1):
        return "X"
    os_ = [(0, c) for c in range(len(grid[0])) if grid[0][c] == "O"]
    if wins("O", os_, lambda r, c: r == h - 1):
        return "O"
    return ""
