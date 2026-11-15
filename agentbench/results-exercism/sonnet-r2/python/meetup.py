import calendar
from datetime import date

_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
_WEEKS = {"first": 0, "1st": 0, "second": 1, "2nd": 1, "third": 2, "3rd": 2,
          "fourth": 3, "4th": 3, "fifth": 4, "5th": 4}


def meetup(year: int, month: int, week: str, dayofweek: str) -> str:
    wd = _DAYS.index(dayofweek.lower())
    ndays = calendar.monthrange(year, month)[1]
    days = [d for d in range(1, ndays + 1) if date(year, month, d).weekday() == wd]
    w = week.lower()
    if w == "teenth":
        d = next(d for d in days if 13 <= d <= 19)
    elif w == "last":
        d = days[-1]
    elif w in _WEEKS:
        if _WEEKS[w] >= len(days):
            raise ValueError("That day does not exist.")
        d = days[_WEEKS[w]]
    else:
        raise ValueError("invalid week")
    return f"{year:04d}-{month:02d}-{d:02d}"
