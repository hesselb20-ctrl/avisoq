def _t(s):
    if len(s) != 5 or s[2] != ":":
        return None
    d = s[:2] + s[3:]
    if not all(c in "0123456789" for c in d):
        return None
    h, m = int(s[:2]), int(s[3:])
    if h > 23 or m > 59:
        return None
    return h * 60 + m


def schedule(s: str) -> str:
    rng = []
    bad = 0
    if s != "":
        for e in s.split(","):
            ok = False
            if len(e) == 11 and e[5] == "-":
                a, b = _t(e[:5]), _t(e[6:])
                if a is not None and b is not None and b > a:
                    rng.append((a, b))
                    ok = True
            if not ok:
                bad += 1
    rng.sort()
    merged = []
    for a, b in rng:
        if merged and a <= merged[-1][1]:
            if b > merged[-1][1]:
                merged[-1][1] = b
        else:
            merged.append([a, b])

    def f(m):
        return "%02d:%02d" % (m // 60, m % 60)

    txt = ",".join(f(a) + "-" + f(b) for a, b in merged)
    total = sum(b - a for a, b in merged)
    return "%s;total=%d;invalid=%d" % (txt, total, bad)
