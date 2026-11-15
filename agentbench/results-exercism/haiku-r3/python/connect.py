from collections import deque


def _neighbours(r: int, c: int):
    # Row r is shifted half a cell right relative to row r - 1.
    return [
        (r, c - 1),
        (r, c + 1),
        (r - 1, c),
        (r - 1, c + 1),
        (r + 1, c - 1),
        (r + 1, c),
    ]


def connect(board: list[str]) -> str:
    cells = [row.split() for row in board]
    if not cells:
        return ""
    height = len(cells)
    width = max(len(row) for row in cells)

    def at(r: int, c: int) -> str:
        if 0 <= r < height and 0 <= c < len(cells[r]):
            return cells[r][c]
        return ""

    def connected(player: str, starts, is_goal) -> bool:
        seen = set()
        queue = deque()
        for pos in starts:
            if at(*pos) == player:
                seen.add(pos)
                queue.append(pos)
        while queue:
            r, c = queue.popleft()
            if is_goal(r, c):
                return True
            for nr, nc in _neighbours(r, c):
                if (nr, nc) not in seen and at(nr, nc) == player:
                    seen.add((nr, nc))
                    queue.append((nr, nc))
        return False

    # X connects left (column 0) to right (last column).
    left_starts = [(r, 0) for r in range(height)]
    if connected("X", left_starts, lambda r, c: c == width - 1):
        return "X"

    # O connects top (row 0) to bottom (last row).
    top_starts = [(0, c) for c in range(width)]
    if connected("O", top_starts, lambda r, c: r == height - 1):
        return "O"

    return ""
