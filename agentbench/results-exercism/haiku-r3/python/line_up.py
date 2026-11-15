def line_up(name: str, number: int) -> str:
    if 11 <= number % 100 <= 13:
        suffix = "th"
    else:
        last = number % 10
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(last, "th")
    return f"{name}, you are the {number}{suffix} customer we serve today. Thank you!"
