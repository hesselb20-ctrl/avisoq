_LINES = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8),
          (0, 4, 8), (2, 4, 6)]


def state_of_tic_tac_toe(board: list[str]) -> str:
    cells = "".join(board)
    x = cells.count("X")
    o = cells.count("O")
    if o > x or x > o + 1:
        raise ValueError("Wrong turn order")

    def won(p):
        return any(all(cells[i] == p for i in line) for line in _LINES)

    xw, ow = won("X"), won("O")
    if xw and ow:
        raise ValueError("Impossible board: game should have ended after the game was won")
    if xw and x != o + 1:
        raise ValueError("Wrong turn order")
    if ow and x != o:
        raise ValueError("Wrong turn order")
    if xw or ow:
        return "win"
    return "draw" if x + o == 9 else "ongoing"
