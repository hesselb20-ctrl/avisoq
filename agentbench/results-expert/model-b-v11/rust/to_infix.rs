fn prec(op: u8) -> u8 {
    match op {
        b'+' | b'-' => 1,
        b'*' | b'/' => 2,
        _ => 3,
    }
}

// Stack entries: (text, operator byte or 0 for an operand).
pub fn to_infix(postfix: &str) -> String {
    let mut st: Vec<(String, u8)> = Vec::new();
    for tok in postfix.split(' ') {
        if tok.is_empty() {
            continue;
        }
        let c = tok.as_bytes()[0];
        if tok.len() == 1 && (c == b'+' || c == b'-' || c == b'*' || c == b'/' || c == b'^') {
            let (rs, rop) = match st.pop() {
                Some(x) => x,
                None => continue,
            };
            let (ls, lop) = match st.pop() {
                Some(x) => x,
                None => continue,
            };
            let p = prec(c);
            let left_paren = lop != 0
                && (prec(lop) < p || (prec(lop) == p && c == b'^'));
            let right_paren = rop != 0
                && (prec(rop) < p || (prec(rop) == p && (c == b'-' || c == b'/')));
            let mut text = String::new();
            if left_paren {
                text.push('(');
                text.push_str(&ls);
                text.push(')');
            } else {
                text.push_str(&ls);
            }
            text.push(c as char);
            if right_paren {
                text.push('(');
                text.push_str(&rs);
                text.push(')');
            } else {
                text.push_str(&rs);
            }
            st.push((text, c));
        } else {
            st.push((tok.to_string(), 0));
        }
    }
    match st.pop() {
        Some((s, _)) => s,
        None => String::new(),
    }
}
