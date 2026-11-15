"""Determine the state of a tic-tac-toe game."""

from typing import List

_EMPTY = " "
_X = "X"
_O = "O"
_VALID_CELLS = {_EMPTY, _X, _O}

_LINES = (
    (0, 1, 2),
    (3, 4, 5),
    (6, 7, 8),
    (0, 3, 6),
    (1, 4, 7),
    (2, 5, 8),
    (0, 4, 8),
    (2, 4, 6),
)


def _validate_board(board: List[str]) -> List[str]:
    if not isinstance(board, list) or len(board) != 3:
        raise ValueError("Invalid board")

    cells: List[str] = []
    for row in board:
        if not isinstance(row, str) or len(row) != 3:
            raise ValueError("Invalid board")
        for cell in row:
            if cell not in _VALID_CELLS:
                raise ValueError("Invalid board")
            cells.append(cell)
    return cells


def _has_won(cells: List[str], mark: str) -> bool:
    return any(cells[a] == cells[b] == cells[c] == mark for a, b, c in _LINES)


def _can_reach(cells: List[str], winner: str) -> bool:
    """
    A winning board is valid only if the last move by the winner could have
    created the win. Equivalently, removing one of the winner's marks must
    remove every winning line for that winner.
    """
    for i, cell in enumerate(cells):
        if cell != winner:
            continue

        previous = cells[:i] + [_EMPTY] + cells[i + 1 :]
        if not _has_won(previous, winner):
            return True

    return False


def state_of_tic_tac_toe(board: list[str]) -> str:
    cells = _validate_board(board)

    x_count = cells.count(_X)
    o_count = cells.count(_O)

    if x_count not in (o_count, o_count + 1):
        raise ValueError("Invalid board")

    x_wins = _has_won(cells, _X)
    o_wins = _has_won(cells, _O)

    if x_wins and o_wins:
        raise ValueError("Invalid board")

    if x_wins:
        if x_count != o_count + 1 or not _can_reach(cells, _X):
            raise ValueError("Invalid board")
        return "win"

    if o_wins:
        if x_count != o_count or not _can_reach(cells, _O):
            raise ValueError("Invalid board")
        return "win"

    if x_count + o_count == 9:
        return "draw"

    return "ongoing"
