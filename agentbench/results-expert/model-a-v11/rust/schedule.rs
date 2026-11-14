fn parse(e: &str) -> Option<(u32, u32)> {
    let b = e.as_bytes();
    if b.len() != 11 || b[2] != b':' || b[5] != b'-' || b[8] != b':' {
        return None;
    }
    let d = |i: usize| -> Option<u32> {
        if b[i].is_ascii_digit() && b[i + 1].is_ascii_digit() {
            Some(((b[i] - b'0') * 10 + (b[i + 1] - b'0')) as u32)
        } else {
            None
        }
    };
    let (h1, m1, h2, m2) = (d(0)?, d(3)?, d(6)?, d(9)?);
    if h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59 {
        return None;
    }
    let s = h1 * 60 + m1;
    let t = h2 * 60 + m2;
    if t <= s {
        return None;
    }
    Some((s, t))
}

fn fmt(m: u32) -> String {
    format!("{:02}:{:02}", m / 60, m % 60)
}

pub fn schedule(s: &str) -> String {
    let mut valid: Vec<(u32, u32)> = Vec::new();
    let mut invalid = 0;
    if !s.is_empty() {
        for e in s.split(',') {
            match parse(e) {
                Some(r) => valid.push(r),
                None => invalid += 1,
            }
        }
    }
    valid.sort();
    let mut merged: Vec<(u32, u32)> = Vec::new();
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
    let total: u32 = merged.iter().map(|r| r.1 - r.0).sum();
    let list: Vec<String> = merged.iter().map(|r| format!("{}-{}", fmt(r.0), fmt(r.1))).collect();
    format!("{};total={};invalid={}", list.join(","), total, invalid)
}
