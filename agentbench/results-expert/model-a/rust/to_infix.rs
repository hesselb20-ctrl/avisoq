fn ti_prec(c: char) -> u8 {
    match c {
        '^' => 3,
        '*' | '/' => 2,
        _ => 1,
    }
}

pub fn to_infix(postfix: &str) -> String {
    let mut st: Vec<(String, u8)> = Vec::new();
    for t in postfix.split_whitespace() {
        let c = t.chars().next().unwrap();
        if c.is_ascii_lowercase() {
            st.push((t.to_string(), 4));
        } else {
            let (rs, rp) = st.pop().unwrap();
            let (ls, lp) = st.pop().unwrap();
            let p = ti_prec(c);
            let lw = lp < p || (lp == p && c == '^');
            let rw = rp < p || (rp == p && (c == '-' || c == '/'));
            let l = if lw { format!("({})", ls) } else { ls };
            let r = if rw { format!("({})", rs) } else { rs };
            st.push((format!("{}{}{}", l, c, r), p));
        }
    }
    st.pop().map(|x| x.0).unwrap_or_default()
}
