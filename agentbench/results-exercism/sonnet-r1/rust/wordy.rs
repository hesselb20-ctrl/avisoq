pub fn wordy(question: &str) -> i64 {
    let q = question.trim();
    let q = match q.strip_prefix("What is") {
        Some(r) => r,
        None => return -1,
    };
    let q = match q.trim_end().strip_suffix('?') {
        Some(r) => r,
        None => return -1,
    };
    let toks: Vec<&str> = q.split_whitespace().collect();
    if toks.is_empty() {
        return -1;
    }
    let mut i = 0;
    let mut acc: i64 = match toks[0].parse::<i64>() {
        Ok(v) => v,
        Err(_) => return -1,
    };
    i += 1;
    while i < toks.len() {
        let op = toks[i];
        i += 1;
        let kind = match op {
            "plus" => 0,
            "minus" => 1,
            "multiplied" | "divided" => {
                if i < toks.len() && toks[i] == "by" {
                    i += 1;
                } else {
                    return -1;
                }
                if op == "multiplied" { 2 } else { 3 }
            }
            _ => return -1,
        };
        if i >= toks.len() {
            return -1;
        }
        let n = match toks[i].parse::<i64>() {
            Ok(v) => v,
            Err(_) => return -1,
        };
        i += 1;
        acc = match kind {
            0 => acc.wrapping_add(n),
            1 => acc.wrapping_sub(n),
            2 => acc.wrapping_mul(n),
            _ => {
                if n == 0 {
                    return -1;
                }
                acc / n
            }
        };
    }
    acc
}
