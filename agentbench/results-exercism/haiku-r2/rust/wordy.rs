pub fn wordy(question: &str) -> i64 {
    let body = match question.trim().strip_prefix("What is ") {
        Some(rest) => rest,
        None => panic!("not a math question"),
    };
    let body = match body.strip_suffix('?') {
        Some(rest) => rest,
        None => panic!("question must end with '?'"),
    };

    let tokens: Vec<&str> = body.split_whitespace().collect();
    if tokens.is_empty() {
        panic!("syntax error");
    }
    let mut acc = parse_number(tokens[0]);
    let mut i = 1;
    while i < tokens.len() {
        match tokens[i] {
            "plus" => {
                let rhs = parse_number(operand(&tokens, i + 1));
                acc = acc.checked_add(rhs).expect("overflow");
                i += 2;
            }
            "minus" => {
                let rhs = parse_number(operand(&tokens, i + 1));
                acc = acc.checked_sub(rhs).expect("overflow");
                i += 2;
            }
            "multiplied" if tokens.get(i + 1) == Some(&"by") => {
                let rhs = parse_number(operand(&tokens, i + 2));
                acc = acc.checked_mul(rhs).expect("overflow");
                i += 3;
            }
            "divided" if tokens.get(i + 1) == Some(&"by") => {
                let rhs = parse_number(operand(&tokens, i + 2));
                acc = acc.checked_div(rhs).expect("division by zero");
                i += 3;
            }
            _ => panic!("unknown operation"),
        }
    }
    acc
}

fn operand<'a>(tokens: &[&'a str], idx: usize) -> &'a str {
    match tokens.get(idx) {
        Some(t) => t,
        None => panic!("syntax error: missing operand"),
    }
}

fn parse_number(token: &str) -> i64 {
    match token.parse::<i64>() {
        Ok(n) => n,
        Err(_) => panic!("not a number"),
    }
}
