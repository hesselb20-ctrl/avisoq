def line_up(name: str, number: int) -> str:
    if number % 100 in (11, 12, 13):
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(number % 10, "th")
    return f"{name}, you are the {number}{suffix} customer we serve today. Thank you!"
