import re

_KEY = re.compile(r'[A-Za-z]+\Z')
_AMT = re.compile(r'-?[0-9]+\Z')


def group_csv(s: str) -> str:
    tot = {}
    bad = 0
    for row in s.split('|'):
        if row.strip(' ') == '':
            continue
        f = row.split(',')
        if len(f) != 2:
            bad += 1
            continue
        k, a = f[0].strip(' '), f[1].strip(' ')
        if _KEY.match(k) and _AMT.match(a):
            tot[k] = tot.get(k, 0) + int(a)
        else:
            bad += 1
    return ','.join('%s=%d' % (k, tot[k]) for k in sorted(tot)) + ';bad=%d' % bad
