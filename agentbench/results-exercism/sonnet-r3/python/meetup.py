import calendar
from datetime import date

_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def meetup(year: int, month: int, week: str, dayofweek: str) -> str:
    wd = _DAYS.index(dayofweek)
    days = calendar.monthrange(year, month)[1]
    matches = [d for d in range(1, days + 1) if date(year, month, d).weekday() == wd]
    if week == "teenth":
        d = next(x for x in matches if 13 <= x <= 19)
    elif week == "last":
        d = matches[-1]
    else:
        idx = {"first": 0, "second": 1, "third": 2, "fourth": 3, "fifth": 4}[week]
        if idx >= len(matches):
            raise ValueError("That day does not exist.")
        d = matches[idx]
    return f"{year:04d}-{month:02d}-{d:02d}"
