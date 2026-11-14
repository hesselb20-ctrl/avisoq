def balanced(s: str) -> bool:
    pairs = {")": "(", "]": "[", "}": "{"}
    opens = set(pairs.values())
    stack = []
    for c in s:
        if c in opens:
            stack.append(c)
        elif c in pairs:
            if not stack or stack.pop() != pairs[c]:
                return False
    return not stack
