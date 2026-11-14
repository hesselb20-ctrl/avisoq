def wrap(s: str, width: int) -> str:
    words = []
    for w in s.split(' '):
        for i in range(0, len(w), width):
            words.append(w[i:i + width])
    lines = []
    cur = None
    for w in words:
        if cur is None:
            cur = w
        elif len(cur) + 1 + len(w) <= width:
            cur += ' ' + w
        else:
            lines.append(cur)
            cur = w
    if cur is not None:
        lines.append(cur)
    return '|'.join(lines)
