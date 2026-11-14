def wrap(s: str, width: int) -> str:
    words = [w for w in s.split(" ") if w]
    pieces = []
    for w in words:
        for i in range(0, len(w), width):
            pieces.append(w[i:i + width])
    if not pieces:
        return ""
    lines = []
    cur = None
    for p in pieces:
        if cur is None:
            cur = p
        elif len(cur) + 1 + len(p) <= width:
            cur = cur + " " + p
        else:
            lines.append(cur)
            cur = p
    lines.append(cur)
    return "|".join(lines)
