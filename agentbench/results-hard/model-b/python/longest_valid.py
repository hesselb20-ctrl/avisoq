_PAIR = {")": "(", "]": "[", "}": "{"}


def longest_valid(s: str) -> int:
    best = 0
    base = -1          # index just before the current valid stretch
    stack = []         # indices of unmatched openers in the current stretch
    for i, c in enumerate(s):
        if c in "([{":
            stack.append(i)
        else:
            if stack and s[stack[-1]] == _PAIR[c]:
                stack.pop()
                if stack:
                    best = max(best, i - stack[-1])
                else:
                    best = max(best, i - base)
            else:
                base = i
                stack = []
    return best
