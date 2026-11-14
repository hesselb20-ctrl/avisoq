import re

_KEY = re.compile(r"[A-Za-z]+")
_AMOUNT = re.compile(r"-?[0-9]+")


def group_csv(s: str) -> str:
    totals = {}
    bad = 0
    for row in s.split("|"):
        if row.strip(" ") == "":
            continue
        fields = row.split(",")
        if len(fields) != 2:
            bad += 1
            continue
        key = fields[0].strip(" ")
        amount = fields[1].strip(" ")
        if not _KEY.fullmatch(key) or not _AMOUNT.fullmatch(amount):
            bad += 1
            continue
        totals[key] = totals.get(key, 0) + int(amount)
    items = [f"{k}={totals[k]}" for k in sorted(totals)]
    return ",".join(items) + f";bad={bad}"
