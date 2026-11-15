fn parse_num(tok: Option<&&str>) -> i64 {
    match tok {
        Some(t) => match t.parse::<i64>() {
            Ok(v) => v,
            Err(_) => panic!("expected a number, got {}", t),
        },
        None => panic!("expected a number at end of question"),
    }
}

pub fn wordy(question: &str) -> i64 {
    let body = match question.trim().strip_prefix("What is") {
        Some(rest) => rest,
        None => panic!("unknown question"),
    };
    let body = match body.strip_suffix('?') {
        Some(rest) => rest,
        None => panic!("question must end with ?"),
    };
    let toks: Vec<&str> = body.split_whitespace().collect();
    if toks.is_empty() {
        panic!("missing number");
    }

    let mut acc = parse_num(toks.first());
    let mut i = 1;
    while i < toks.len() {
        match toks[i] {
            "plus" => {
                acc += parse_num(toks.get(i + 1));
                i += 2;
            }
            "minus" => {
                acc -= parse_num(toks.get(i + 1));
                i += 2;
            }
            "multiplied" => {
                if toks.get(i + 1) != Some(&"by") {
                    panic!("expected 'by' after 'multiplied'");
                }
                acc *= parse_num(toks.get(i + 2));
                i += 3;
            }
            "divided" => {
                if toks.get(i + 1) != Some(&"by") {
                    panic!("expected 'by' after 'divided'");
                }
                let d = parse_num(toks.get(i + 2));
                if d == 0 {
                    panic!("division by zero");
                }
                acc /= d;
                i += 3;
            }
            other => panic!("unsupported operation: {}", other),
        }
    }
    acc
}
