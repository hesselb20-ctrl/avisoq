pub fn wordy(question: &str) -> i64 {
    let q = question.trim();
    let q = match q.strip_prefix("What is") { Some(r) => r, None => return -1 };
    let q = match q.strip_suffix('?') { Some(r) => r, None => return -1 };
    let t: Vec<&str> = q.split_whitespace().collect();
    if t.is_empty() { return -1; }
    let mut acc: i64 = match t[0].parse() { Ok(v) => v, Err(_) => return -1 };
    let mut i = 1;
    while i < t.len() {
        let w = t[i];
        i += 1;
        let op = match w {
            "plus" => '+',
            "minus" => '-',
            "multiplied" | "divided" => {
                if i < t.len() && t[i] == "by" { i += 1; } else { return -1; }
                if w == "multiplied" { '*' } else { '/' }
            }
            _ => return -1,
        };
        if i >= t.len() { return -1; }
        let n: i64 = match t[i].parse() { Ok(v) => v, Err(_) => return -1 };
        i += 1;
        acc = match op {
            '+' => acc.wrapping_add(n),
            '-' => acc.wrapping_sub(n),
            '*' => acc.wrapping_mul(n),
            _ => { if n == 0 { return -1; } acc / n }
        };
    }
    acc
}
