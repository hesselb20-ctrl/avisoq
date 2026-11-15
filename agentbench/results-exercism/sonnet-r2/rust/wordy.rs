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
    let mut acc: i64 = match toks[0].parse::<i64>() {
        Ok(n) => n,
        Err(_) => return -1,
    };
    let mut i = 1;
    while i < toks.len() {
        let word = toks[i];
        i += 1;
        let op = match word {
            "plus" => '+',
            "minus" => '-',
            "multiplied" | "divided" => {
                if i < toks.len() && toks[i] == "by" {
                    i += 1;
                    if word == "multiplied" {
                        '*'
                    } else {
                        '/'
                    }
                } else {
                    return -1;
                }
            }
            _ => return -1,
        };
        if i >= toks.len() {
            return -1;
        }
        let n = match toks[i].parse::<i64>() {
            Ok(n) => n,
            Err(_) => return -1,
        };
        i += 1;
        acc = match op {
            '+' => acc + n,
            '-' => acc - n,
            '*' => acc * n,
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
