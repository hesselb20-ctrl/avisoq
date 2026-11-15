import calendar
import datetime

_WEEKDAYS = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}

_ORDINALS = {"first": 0, "second": 1, "third": 2, "fourth": 3}


def meetup(year: int, month: int, week: str, dayofweek: str) -> str:
    target = _WEEKDAYS[dayofweek.strip().capitalize()]
    last_day = calendar.monthrange(year, month)[1]
    matches = [
        day
        for day in range(1, last_day + 1)
        if datetime.date(year, month, day).weekday() == target
    ]
    week_key = week.strip().lower()
    if week_key == "teenth":
        day = next(d for d in matches if 13 <= d <= 19)
    elif week_key == "last":
        day = matches[-1]
    else:
        day = matches[_ORDINALS[week_key]]
    return datetime.date(year, month, day).isoformat()
