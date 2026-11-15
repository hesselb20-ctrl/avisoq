import calendar
from datetime import date

_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_ORDINALS = {"first": 0, "second": 1, "third": 2, "fourth": 3, "fifth": 4, "sixth": 5}


def meetup(year: int, month: int, week: str, dayofweek: str) -> str:
    weekday = _WEEKDAYS.index(dayofweek)  # Monday == 0, same as date.weekday()
    last_day = calendar.monthrange(year, month)[1]
    matches = [
        day
        for day in range(1, last_day + 1)
        if date(year, month, day).weekday() == weekday
    ]
    if week == "last":
        day = matches[-1]
    elif week == "teenth":
        day = next(d for d in matches if 13 <= d <= 19)
    elif week in _ORDINALS:
        index = _ORDINALS[week]
        if index >= len(matches):
            raise ValueError("that day does not exist in this month")
        day = matches[index]
    else:
        raise ValueError("unknown week")
    return date(year, month, day).isoformat()
