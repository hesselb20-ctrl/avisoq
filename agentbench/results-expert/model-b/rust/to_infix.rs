// Precedence levels: 1 for + -, 2 for * /, 3 for ^, 4 for a single operand.
fn prec(c: u8) -> u8 {
    match c {
        b'+' | b'-' => 1,
        b'*' | b'/' => 2,
        _ => 3,
    }
}

fn wrap(s: String, child: u8, parent: u8, op: u8, right: bool) -> String {
    if child == 4 {
        return s;
    }
    let need = if child < parent {
        true
    } else if child == parent {
        (right && (op == b'-' || op == b'/')) || (!right && op == b'^')
    } else {
        false
    };
    if need {
        format!("({})", s)
    } else {
        s
    }
}

pub fn to_infix(postfix: &str) -> String {
    let mut st: Vec<(String, u8)> = Vec::new();
    for tok in postfix.split(' ') {
        if tok.is_empty() {
            continue;
        }
        let c = tok.as_bytes()[0];
        if tok.len() == 1 && (c == b'+' || c == b'-' || c == b'*' || c == b'/' || c == b'^') {
            let (r, rp) = st.pop().unwrap();
            let (l, lp) = st.pop().unwrap();
            let p = prec(c);
            let ls = wrap(l, lp, p, c, false);
            let rs = wrap(r, rp, p, c, true);
            st.push((format!("{}{}{}", ls, c as char, rs), p));
        } else {
            st.push((tok.to_string(), 4));
        }
    }
    match st.pop() {
        Some((s, _)) => s,
        None => String::new(),
    }
}
