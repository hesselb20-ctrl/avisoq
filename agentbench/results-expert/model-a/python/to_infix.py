def to_infix(postfix: str) -> str:
    prec = {"^": 3, "*": 2, "/": 2, "+": 1, "-": 1}
    st = []
    for t in postfix.split():
        if t in prec:
            rs, rp = st.pop()
            ls, lp = st.pop()
            p = prec[t]
            if lp < p or (lp == p and t == "^"):
                ls = "(" + ls + ")"
            if rp < p or (rp == p and t in "-/"):
                rs = "(" + rs + ")"
            st.append((ls + t + rs, p))
        else:
            st.append((t, 99))
    return st[-1][0] if st else ""
