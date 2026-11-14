import datetime


def add_days(y: int, m: int, d: int, n: int) -> str:
    r = datetime.date(y, m, d) + datetime.timedelta(days=n)
    return "%04d-%02d-%02d" % (r.year, r.month, r.day)
