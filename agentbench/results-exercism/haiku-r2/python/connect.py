from collections import deque

_NEIGHBOURS = [(0, -1), (0, 1), (-1, 0), (-1, 1), (1, -1), (1, 0)]


def _connected(grid: list[list[str]], player: str) -> bool:
    rows = len(grid)
    if player == "O":
        # O connects the top row to the bottom row.
        starts = [(0, c) for c, cell in enumerate(grid[0]) if cell == player] if rows else []
        is_goal = lambda r, c: r == rows - 1
    else:
        # X connects the left column to the right edge of each row.
        starts = [(r, 0) for r in range(rows) if grid[r] and grid[r][0] == player]
        is_goal = lambda r, c: c == len(grid[r]) - 1

    seen = set(starts)
    queue = deque(starts)
    while queue:
        r, c = queue.popleft()
        if is_goal(r, c):
            return True
        for dr, dc in _NEIGHBOURS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < len(grid[nr]) and grid[nr][nc] == player:
                if (nr, nc) not in seen:
                    seen.add((nr, nc))
                    queue.append((nr, nc))
    return False


def connect(board: list[str]) -> str:
    grid = [row.split() for row in board]
    if not grid:
        return ""
    if _connected(grid, "O"):
        return "O"
    if _connected(grid, "X"):
        return "X"
    return ""
