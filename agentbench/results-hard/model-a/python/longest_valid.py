def longest_valid(s: str) -> int:
    pairs = {')': '(', ']': '[', '}': '{'}
    st = [-1]
    best = 0
    for i, c in enumerate(s):
        if c in '([{':
            st.append(i)
        elif len(st) > 1 and s[st[-1]] == pairs[c]:
            st.pop()
            best = max(best, i - st[-1])
        else:
            st = [i]
    return best
