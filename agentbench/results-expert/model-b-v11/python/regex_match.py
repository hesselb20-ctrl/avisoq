def regex_match(pattern: str, text: str) -> bool:
    p = pattern
    plen = len(p)
    t = text
    n = len(t)
    pos = [0]

    def parse_alt():
        seqs = [parse_seq()]
        while pos[0] < plen and p[pos[0]] == '|':
            pos[0] += 1
            seqs.append(parse_seq())
        return ('alt', seqs)

    def parse_seq():
        items = []
        while pos[0] < plen and p[pos[0]] not in '|)':
            items.append(parse_postfix())
        return ('seq', items)

    def parse_postfix():
        a = parse_atom()
        while pos[0] < plen and p[pos[0]] in '*+?':
            q = p[pos[0]]
            pos[0] += 1
            a = (q, a)
        return a

    def parse_atom():
        c = p[pos[0]]
        pos[0] += 1
        if c == '(':
            a = parse_alt()
            pos[0] += 1  # consume ')'
            return a
        if c == '.':
            return ('any',)
        return ('ch', c)

    root = parse_alt()
    memo = {}

    def closure(atom, starts):
        result = set(starts)
        frontier = set(starts)
        while frontier:
            nxt = set()
            for q in frontier:
                nxt |= m(atom, q)
            new = nxt - result
            result |= new
            frontier = new
        return frozenset(result)

    def m(node, i):
        key = (id(node), i)
        if key in memo:
            return memo[key]
        k = node[0]
        if k == 'ch':
            r = frozenset([i + 1]) if i < n and t[i] == node[1] else frozenset()
        elif k == 'any':
            r = frozenset([i + 1]) if i < n else frozenset()
        elif k == 'alt':
            res = set()
            for seq in node[1]:
                res |= m(seq, i)
            r = frozenset(res)
        elif k == 'seq':
            cur = {i}
            for it in node[1]:
                nxt = set()
                for q in cur:
                    nxt |= m(it, q)
                cur = nxt
                if not cur:
                    break
            r = frozenset(cur)
        elif k == '*':
            r = closure(node[1], {i})
        elif k == '+':
            r = closure(node[1], m(node[1], i))
        else:  # '?'
            r = frozenset({i}) | m(node[1], i)
        memo[key] = r
        return r

    return n in m(root, 0)
