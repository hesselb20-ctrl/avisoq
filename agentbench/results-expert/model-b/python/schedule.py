import re

_RANGE = re.compile(r'([0-9]{2}):([0-9]{2})-([0-9]{2}):([0-9]{2})')


def schedule(s: str) -> str:
    if s == '':
        return ';total=0;invalid=0'
    ranges = []
    invalid = 0
    for entry in s.split(','):
        m = _RANGE.fullmatch(entry)
        if not m:
            invalid += 1
            continue
        h1, m1, h2, m2 = (int(g) for g in m.groups())
        if h1 > 23 or h2 > 23 or m1 > 59 or m2 > 59:
            invalid += 1
            continue
        start = h1 * 60 + m1
        end = h2 * 60 + m2
        if end <= start:
            invalid += 1
            continue
        ranges.append((start, end))

    ranges.sort()
    merged = []
    for st, en in ranges:
        if merged and st <= merged[-1][1]:
            if en > merged[-1][1]:
                merged[-1][1] = en
        else:
            merged.append([st, en])

    def fmt(t):
        return '%02d:%02d' % (t // 60, t % 60)

    total = sum(en - st for st, en in merged)
    body = ','.join('%s-%s' % (fmt(st), fmt(en)) for st, en in merged)
    return '%s;total=%d;invalid=%d' % (body, total, invalid)
