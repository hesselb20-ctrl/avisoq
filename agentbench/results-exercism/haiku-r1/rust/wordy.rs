fn parse_num(s: &str) -> i64 {
    match s.parse::<i64>() {
        Ok(n) => n,
        Err(_) => panic!("invalid number in question"),
    }
}

pub fn wordy(question: &str) -> i64 {
    let q = question.trim();
    let rest = match q.strip_prefix("What is") {
        Some(r) => r,
        None => panic!("unknown operation"),
    };
    if !rest.starts_with(char::is_whitespace) {
        panic!("unknown operation");
    }
    let body = match rest.trim_end().strip_suffix('?') {
        Some(b) => b,
        None => panic!("not a math question"),
    };
    let toks: Vec<&str> = body.split_whitespace().collect();
    if toks.is_empty() {
        panic!("no number in question");
    }
    let mut acc = parse_num(toks[0]);
    let mut i = 1;
    while i < toks.len() {
        let op = toks[i].to_ascii_lowercase();
        i += 1;
        let kind = match op.as_str() {
            "plus" => 0,
            "minus" => 1,
            "multiplied" | "divided" => {
                if i < toks.len() && toks[i].eq_ignore_ascii_case("by") {
                    i += 1;
                } else {
                    panic!("invalid syntax");
                }
                if op == "multiplied" {
                    2
                } else {
                    3
                }
            }
            _ => panic!("unsupported operation"),
        };
        if i >= toks.len() {
            panic!("invalid syntax");
        }
        let rhs = parse_num(toks[i]);
        i += 1;
        acc = match kind {
            0 => acc.checked_add(rhs),
            1 => acc.checked_sub(rhs),
            2 => acc.checked_mul(rhs),
            _ => acc.checked_div(rhs),
        }
        .unwrap_or_else(|| panic!("arithmetic error"));
    }
    acc
}
