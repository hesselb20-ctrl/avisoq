def ledger(ops: str) -> str:
    accounts = {}
    rejected = 0
    if ops == "":
        pieces = []
    else:
        pieces = ops.split(";")

    def amount(text):
        try:
            return int(text)
        except ValueError:
            return None

    for piece in pieces:
        words = piece.split()
        if not words:
            continue
        cmd = words[0]
        ok = False
        if cmd == "open" and len(words) == 2:
            name = words[1]
            if name not in accounts:
                accounts[name] = 0
                ok = True
        elif cmd == "deposit" and len(words) == 3:
            name = words[1]
            a = amount(words[2])
            if name in accounts and a is not None and a > 0:
                accounts[name] += a
                ok = True
        elif cmd == "withdraw" and len(words) == 3:
            name = words[1]
            a = amount(words[2])
            if name in accounts and a is not None and a > 0 and accounts[name] >= a:
                accounts[name] -= a
                ok = True
        elif cmd == "transfer" and len(words) == 4:
            src, dst = words[1], words[2]
            a = amount(words[3])
            if (
                src in accounts
                and dst in accounts
                and src != dst
                and a is not None
                and a > 0
                and accounts[src] >= a
            ):
                accounts[src] -= a
                accounts[dst] += a
                ok = True
        elif cmd == "close" and len(words) == 2:
            name = words[1]
            if name in accounts and accounts[name] == 0:
                del accounts[name]
                ok = True
        if not ok:
            rejected += 1

    items = [f"{name}={accounts[name]}" for name in sorted(accounts)]
    return ",".join(items) + f";rejected={rejected}"
