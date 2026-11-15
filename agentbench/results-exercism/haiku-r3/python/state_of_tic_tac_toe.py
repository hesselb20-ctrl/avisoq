_LINES = [
    [(0, 0), (0, 1), (0, 2)],
    [(1, 0), (1, 1), (1, 2)],
    [(2, 0), (2, 1), (2, 2)],
    [(0, 0), (1, 0), (2, 0)],
    [(0, 1), (1, 1), (2, 1)],
    [(0, 2), (1, 2), (2, 2)],
    [(0, 0), (1, 1), (2, 2)],
    [(0, 2), (1, 1), (2, 0)],
]


def _has_win(board, mark: str) -> bool:
    for line in _LINES:
        if all(board[r][c] == mark for r, c in line):
            return True
    return False


def state_of_tic_tac_toe(board: list[str]) -> str:
    if len(board) != 3 or any(len(row) != 3 for row in board):
        raise ValueError("board must be 3x3")
    for row in board:
        for ch in row:
            if ch not in "XO ":
                raise ValueError("invalid character on board")

    x_count = sum(row.count("X") for row in board)
    o_count = sum(row.count("O") for row in board)
    if not (x_count == o_count or x_count == o_count + 1):
        raise ValueError("wrong turn order")

    x_wins = _has_win(board, "X")
    o_wins = _has_win(board, "O")

    if x_wins and o_wins:
        raise ValueError("both players cannot win")
    if x_wins and x_count != o_count + 1:
        raise ValueError("X won but it was not X's last move")
    if o_wins and x_count != o_count:
        raise ValueError("O won but it was not O's last move")
    if x_wins or o_wins:
        return "win"

    if x_count + o_count == 9:
        return "draw"
    return "ongoing"
