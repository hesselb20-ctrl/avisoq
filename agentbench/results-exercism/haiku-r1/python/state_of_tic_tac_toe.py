_LINES = (
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6),
)


def state_of_tic_tac_toe(board: list[str]) -> str:
    if len(board) != 3 or any(len(row) != 3 for row in board):
        raise ValueError("board must be 3 rows of 3 cells")
    cells = "".join(board)
    if any(ch not in " XO" for ch in cells):
        raise ValueError("invalid cell character")

    x_count = cells.count("X")
    o_count = cells.count("O")
    if x_count not in (o_count, o_count + 1):
        raise ValueError("wrong turn order")

    def wins(player: str) -> bool:
        return any(all(cells[i] == player for i in line) for line in _LINES)

    x_wins = wins("X")
    o_wins = wins("O")
    if x_wins and o_wins:
        raise ValueError("both players cannot win")
    if x_wins and x_count != o_count + 1:
        raise ValueError("X won but turn order is wrong")
    if o_wins and x_count != o_count:
        raise ValueError("O won but turn order is wrong")
    if x_wins or o_wins:
        return "win"
    if x_count + o_count == 9:
        return "draw"
    return "ongoing"
