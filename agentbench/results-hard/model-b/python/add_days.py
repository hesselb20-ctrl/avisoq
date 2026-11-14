from datetime import date, timedelta


def add_days(y: int, m: int, d: int, n: int) -> str:
    result = date(y, m, d) + timedelta(days=n)
    return f"{result.year:04d}-{result.month:02d}-{result.day:02d}"
