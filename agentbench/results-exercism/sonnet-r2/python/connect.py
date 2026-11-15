def connect(board: list[str]) -> str:
    grid = [line.split() for line in board]
    grid = [r for r in grid if r]
    if not grid:
        return ""
    h = len(grid)
    nbrs = [(0, -1), (0, 1), (-1, 0), (-1, 1), (1, 0), (1, -1)]

    def wins(player, starts, is_goal):
        stack = [p for p in starts if grid[p[0]][p[1]] == player]
        seen = set(stack)
        while stack:
            r, c = stack.pop()
            if is_goal(r, c):
                return True
            for dr, dc in nbrs:
                nr, nc = r + dr, c + dc
                if (0 <= nr < h and 0 <= nc < len(grid[nr])
                        and (nr, nc) not in seen and grid[nr][nc] == player):
                    seen.add((nr, nc))
                    stack.append((nr, nc))
        return False

    if wins("X", [(r, 0) for r in range(h)], lambda r, c: c == len(grid[r]) - 1):
        return "X"
    if wins("O", [(0, c) for c in range(len(grid[0]))], lambda r, c: r == h - 1):
        return "O"
    return ""
