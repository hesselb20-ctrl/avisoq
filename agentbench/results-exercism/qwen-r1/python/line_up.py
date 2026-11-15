def line_up(name: str, number: int) -> str:
    n = int(number)

    if n % 100 in (11, 12, 13):
        suffix = "th"
    else:
        last_digit = n % 10
        if last_digit == 1:
            suffix = "st"
        elif last_digit == 2:
            suffix = "nd"
        elif last_digit == 3:
            suffix = "rd"
        else:
            suffix = "th"

    return f"{name}, you are the {n}{suffix} customer we serve today. Thank you!"
