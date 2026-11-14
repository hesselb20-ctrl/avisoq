fn prec(c: char) -> u8 {
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
        if "+-*/^".contains(c) && t.len() == 1 {
            let (rs, rp) = st.pop().unwrap_or((String::new(), 99));
            let (ls, lp) = st.pop().unwrap_or((String::new(), 99));
            let p = prec(c);
            let lw = lp < p || (lp == p && c == '^');
            let rw = rp < p || (rp == p && (c == '-' || c == '/'));
            let l = if lw { format!("({})", ls) } else { ls };
            let r = if rw { format!("({})", rs) } else { rs };
            st.push((format!("{}{}{}", l, c, r), p));
        } else {
            st.push((t.to_string(), 99));
        }
    }
    st.pop().map(|x| x.0).unwrap_or_default()
}
