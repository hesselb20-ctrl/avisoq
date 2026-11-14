def caesar(s: str, k: int) -> str:
    out = []
    shift = k % 26
    for c in s:
        if "a" <= c <= "z":
            out.append(chr((ord(c) - ord("a") + shift) % 26 + ord("a")))
        elif "A" <= c <= "Z":
            out.append(chr((ord(c) - ord("A") + shift) % 26 + ord("A")))
        else:
            out.append(c)
    return "".join(out)
