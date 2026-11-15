_LINES = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),  # rows
    (0, 3, 6), (1, 4, 7), (2, 5, 8),  # columns
    (0, 4, 8), (2, 4, 6),             # diagonals
]


def _has_win(cells: str, player: str) -> bool:
    return any(all(cells[i] == player for i in line) for line in _LINES)


def state_of_tic_tac_toe(board: list[str]) -> str:
    if len(board) != 3 or any(len(row) != 3 for row in board):
        raise ValueError("board must be 3x3")
    cells = "".join(board)
    if any(ch not in "XO " for ch in cells):
        raise ValueError("invalid character on board")

    x_count = cells.count("X")
    o_count = cells.count("O")
    if x_count - o_count not in (0, 1):
        raise ValueError("wrong turn order")

    x_wins = _has_win(cells, "X")
    o_wins = _has_win(cells, "O")
    if x_wins and o_wins:
        raise ValueError("impossible board: both players cannot win")
    if x_wins and x_count != o_count + 1:
        raise ValueError("impossible board: game should have ended after the game was won")
    if o_wins and x_count != o_count:
        raise ValueError("impossible board: game should have ended after the game was won")

    if x_wins or o_wins:
        return "win"
    if x_count + o_count == 9:
        return "draw"
    return "ongoing"
