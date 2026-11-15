import calendar
from datetime import date

_WEEKDAY_TO_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

_WEEK_ORDINALS = {
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
}


def meetup(year: int, month: int, week: str, dayofweek: str) -> str:
    target_weekday = _WEEKDAY_TO_INDEX[dayofweek.lower()]
    week = week.lower()
    last_day = calendar.monthrange(year, month)[1]

    if week == "teenth":
        for day in range(13, 20):
            if date(year, month, day).weekday() == target_weekday:
                return f"{year:04d}-{month:02d}-{day:02d}"

    if week == "last":
        for day in range(last_day, 0, -1):
            if date(year, month, day).weekday() == target_weekday:
                return f"{year:04d}-{month:02d}-{day:02d}"

    ordinal = _WEEK_ORDINALS[week]
    first_day = next(
        day
        for day in range(1, last_day + 1)
        if date(year, month, day).weekday() == target_weekday
    )
    day = first_day + 7 * (ordinal - 1)
    return f"{year:04d}-{month:02d}-{day:02d}"
