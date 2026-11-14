def ledger(ops: str) -> str:
    acc = {}
    rej = 0
    for raw in ops.split(';'):
        w = raw.split()
        if not w:
            continue
        ok = False
        try:
            c = w[0]
            if c == 'open' and len(w) == 2:
                if w[1] not in acc:
                    acc[w[1]] = 0
                    ok = True
            elif c in ('deposit', 'withdraw') and len(w) == 3:
                nm = w[1]
                a = int(w[2])
                if nm in acc and a > 0:
                    if c == 'deposit':
                        acc[nm] += a
                        ok = True
                    elif acc[nm] >= a:
                        acc[nm] -= a
                        ok = True
            elif c == 'transfer' and len(w) == 4:
                f, t = w[1], w[2]
                a = int(w[3])
                if f in acc and t in acc and f != t and a > 0 and acc[f] >= a:
                    acc[f] -= a
                    acc[t] += a
                    ok = True
            elif c == 'close' and len(w) == 2:
                if w[1] in acc and acc[w[1]] == 0:
                    del acc[w[1]]
                    ok = True
        except ValueError:
            ok = False
        if not ok:
            rej += 1
    return ','.join('%s=%d' % (k, acc[k]) for k in sorted(acc)) + ';rejected=%d' % rej
