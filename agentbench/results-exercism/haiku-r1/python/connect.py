from collections import deque

# Neighbour offsets on the parallelogram: row r+1 is drawn one step further right,
# so a cell touches (r, c+1), (r, c-1), (r-1, c), (r-1, c+1), (r+1, c), (r+1, c-1).
_NEIGHBOURS = ((0, 1), (0, -1), (-1, 0), (-1, 1), (1, 0), (1, -1))


def _connected(grid, player, starts, is_goal) -> bool:
    seen = set(starts)
    queue = deque(starts)
    while queue:
        r, c = queue.popleft()
        if is_goal(r, c):
            return True
        for dr, dc in _NEIGHBOURS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < len(grid) and 0 <= nc < len(grid[nr]):
                if (nr, nc) not in seen and grid[nr][nc] == player:
                    seen.add((nr, nc))
                    queue.append((nr, nc))
    return False


def connect(board: list[str]) -> str:
    grid = [line.split() for line in board]
    if not grid:
        return ""
    rows = len(grid)

    # O plays top to bottom.
    o_starts = [(0, c) for c, cell in enumerate(grid[0]) if cell == "O"]
    if o_starts and _connected(grid, "O", o_starts, lambda r, c: r == rows - 1):
        return "O"

    # X plays left to right.
    x_starts = [(r, 0) for r in range(rows) if grid[r] and grid[r][0] == "X"]
    if x_starts and _connected(
        grid, "X", x_starts, lambda r, c: c == len(grid[r]) - 1
    ):
        return "X"
    return ""
