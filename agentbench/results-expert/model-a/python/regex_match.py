def _parse(p):
    pos = [0]

    def alt():
        seqs = [seq()]
        while pos[0] < len(p) and p[pos[0]] == "|":
            pos[0] += 1
            seqs.append(seq())
        return ("alt", seqs)

    def seq():
        items = []
        while pos[0] < len(p) and p[pos[0]] not in "|)":
            c = p[pos[0]]
            pos[0] += 1
            if c == "(":
                atom = alt()
                pos[0] += 1  # )
            else:
                atom = ("ch", c)
            q = ""
            while pos[0] < len(p) and p[pos[0]] in "*+?":
                q = p[pos[0]]
                pos[0] += 1
            items.append((atom, q))
        return items

    return alt()


def _run(node, starts, text):
    if node[0] == "ch":
        c = node[1]
        return {i + 1 for i in starts if i < len(text) and (c == "." or text[i] == c)}
    res = set()
    for seq in node[1]:
        cur = set(starts)
        for atom, q in seq:
            if not cur:
                break
            if q == "":
                cur = _run(atom, cur, text)
            elif q == "?":
                cur = cur | _run(atom, cur, text)
            else:
                reach = set(cur) if q == "*" else set()
                frontier = cur
                while frontier:
                    nxt = _run(atom, frontier, text) - reach
                    reach |= nxt
                    frontier = nxt
                cur = reach
        res |= cur
    return res


def regex_match(pattern: str, text: str) -> bool:
    ast = _parse(pattern)
    return len(text) in _run(ast, {0}, text)
