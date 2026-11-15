import calendar
from datetime import date

_DAY_NAMES = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]

_ORDINALS = {
    "first": 0,
    "second": 1,
    "third": 2,
    "fourth": 3,
    "fifth": 4,
}


def meetup(year: int, month: int, week: str, dayofweek: str) -> str:
    weekday = _DAY_NAMES.index(dayofweek.lower())
    days_in_month = calendar.monthrange(year, month)[1]
    matches = [
        d
        for d in range(1, days_in_month + 1)
        if date(year, month, d).weekday() == weekday
    ]
    week_key = week.lower()
    if week_key == "teenth":
        chosen = next(d for d in matches if 13 <= d <= 19)
    elif week_key == "last":
        chosen = matches[-1]
    elif week_key in _ORDINALS:
        index = _ORDINALS[week_key]
        if index >= len(matches):
            raise ValueError("that day does not exist in this month")
        chosen = matches[index]
    else:
        raise ValueError("unknown week")
    return date(year, month, chosen).isoformat()
