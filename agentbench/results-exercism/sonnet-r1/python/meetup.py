import calendar
import datetime

_DAYS = {n: i for i, n in enumerate(
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])}
_NTH = {"first": 0, "second": 1, "third": 2, "fourth": 3, "fifth": 4}


def meetup(year: int, month: int, week: str, dayofweek: str) -> str:
    wd = _DAYS[dayofweek]
    ndays = calendar.monthrange(year, month)[1]
    days = [d for d in range(1, ndays + 1)
            if datetime.date(year, month, d).weekday() == wd]
    if week == "teenth":
        day = next(d for d in days if 13 <= d <= 19)
    elif week == "last":
        day = days[-1]
    else:
        idx = _NTH[week]
        if idx >= len(days):
            raise ValueError("That day does not exist.")
        day = days[idx]
    return f"{year:04d}-{month:02d}-{day:02d}"
