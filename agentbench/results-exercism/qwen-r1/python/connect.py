"""Determine the winner of a Hex / Polygon board."""

from __future__ import annotations


def _parse(board: list[str]) -> list[list[str]]:
    """Parse the indented board representation into a rectangular grid."""
    rows: list[list[str]] = []
    for line in board:
        cells = line.split()
        if cells:
            rows.append(cells)
    return rows


def _neighbors(r: int, c: int, rows: int, cols: int) -> list[tuple[int, int]]:
    """Return valid neighboring cells for the given board layout."""
    candidates = (
        (r, c - 1),
        (r, c + 1),
        (r - 1, c - 1),
        (r - 1, c),
        (r + 1, c),
        (r + 1, c + 1),
    )
    return [(nr, nc) for nr, nc in candidates if 0 <= nr < rows and 0 <= nc < cols]


def _has_connection(
    grid: list[list[str]],
    player: str,
    start_side: str,
    end_side: str,
) -> bool:
    """Return True if `player` connects `start_side` to `end_side`."""
    rows = len(grid)
    if rows == 0:
        return False
    cols = len(grid[0])
    if cols == 0:
        return False

    visited: set[tuple[int, int]] = set()
    stack: list[tuple[int, int]] = []

    if start_side == "top":
        for c in range(cols):
            if grid[0][c] == player:
                stack.append((0, c))
                visited.add((0, c))
    elif start_side == "bottom":
        for c in range(cols):
            if grid[rows - 1][c] == player:
                stack.append((rows - 1, c))
                visited.add((rows - 1, c))
    elif start_side == "left":
        for r in range(rows):
            if grid[r][0] == player:
                stack.append((r, 0))
                visited.add((r, 0))
    elif start_side == "right":
        for r in range(rows):
            if grid[r][cols - 1] == player:
                stack.append((r, cols - 1))
                visited.add((r, cols - 1))

    while stack:
        r, c = stack.pop()

        if end_side == "top" and r == 0:
            return True
        if end_side == "bottom" and r == rows - 1:
            return True
        if end_side == "left" and c == 0:
            return True
        if end_side == "right" and c == cols - 1:
            return True

        for nr, nc in _neighbors(r, c, rows, cols):
            if (nr, nc) not in visited and grid[nr][nc] == player:
                visited.add((nr, nc))
                stack.append((nr, nc))

    return False


def connect(board: list[str]) -> str:
    """Return "O" if O connects top to bottom, "X" if X connects left to right, else ""."""
    grid = _parse(board)
    if not grid:
        return ""

    if _has_connection(grid, "O", "top", "bottom"):
        return "O"
    if _has_connection(grid, "X", "left", "right"):
        return "X"
    return ""
