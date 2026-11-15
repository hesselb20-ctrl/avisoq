def luhn(value: str) -> bool:
    total = 0
    digit_count = 0

    for char in reversed(value):
        if char == " ":
            continue

        if not ("0" <= char <= "9"):
            return False

        digit = ord(char) - ord("0")

        if digit_count % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9

        total += digit
        digit_count += 1

    return digit_count > 1 and total % 10 == 0
