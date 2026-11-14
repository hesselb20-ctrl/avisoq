fn parse_range(e: &str) -> Option<(i64, i64)> {
    let b = e.as_bytes();
    if b.len() != 11 || b[2] != b':' || b[5] != b'-' || b[8] != b':' {
        return None;
    }
    let d = |i: usize| -> Option<i64> {
        if b[i].is_ascii_digit() {
            Some((b[i] - b'0') as i64)
        } else {
            None
        }
    };
    let h1 = d(0)? * 10 + d(1)?;
    let m1 = d(3)? * 10 + d(4)?;
    let h2 = d(6)? * 10 + d(7)?;
    let m2 = d(9)? * 10 + d(10)?;
    if h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59 {
        return None;
    }
    let s = h1 * 60 + m1;
    let t = h2 * 60 + m2;
    if t <= s {
        None
    } else {
        Some((s, t))
    }
}

pub fn schedule(s: &str) -> String {
    let mut valid: Vec<(i64, i64)> = Vec::new();
    let mut invalid: usize = 0;
    if !s.is_empty() {
        for ent in s.split(',') {
            match parse_range(ent) {
                Some(r) => valid.push(r),
                None => invalid += 1,
            }
        }
    }
    valid.sort();
    let mut merged: Vec<(i64, i64)> = Vec::new();
    for (a, b) in valid {
        if let Some(last) = merged.last_mut() {
            if a <= last.1 {
                if b > last.1 {
                    last.1 = b;
                }
                continue;
            }
        }
        merged.push((a, b));
    }
    let total: i64 = merged.iter().map(|&(a, b)| b - a).sum();
    let parts: Vec<String> = merged
        .iter()
        .map(|&(a, b)| format!("{:02}:{:02}-{:02}:{:02}", a / 60, a % 60, b / 60, b % 60))
        .collect();
    format!("{};total={};invalid={}", parts.join(","), total, invalid)
}
