_LINES = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]


def state_of_tic_tac_toe(board: list[str]) -> str:
    cells = "".join(board)
    x = cells.count("X")
    o = cells.count("O")
    if x < o:
        raise ValueError("Wrong turn order: O started")
    if x > o + 1:
        raise ValueError("Wrong turn order: X went twice")
    xw = any(all(cells[i] == "X" for i in ln) for ln in _LINES)
    ow = any(all(cells[i] == "O" for i in ln) for ln in _LINES)
    if xw and ow:
        raise ValueError("Impossible board: game should have ended after the game was won")
    if xw and x != o + 1:
        raise ValueError("Impossible board: game should have ended after the game was won")
    if ow and x != o:
        raise ValueError("Impossible board: game should have ended after the game was won")
    if xw or ow:
        return "win"
    return "draw" if x + o == 9 else "ongoing"
