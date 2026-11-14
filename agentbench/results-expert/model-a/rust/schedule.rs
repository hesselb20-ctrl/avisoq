fn sc_parse(e: &str) -> Option<(u32, u32)> {
    let b = e.as_bytes();
    if b.len() != 11 || b[2] != b':' || b[5] != b'-' || b[8] != b':' {
        return None;
    }
    for &i in &[0usize, 1, 3, 4, 6, 7, 9, 10] {
        if !b[i].is_ascii_digit() {
            return None;
        }
    }
    let n = |i: usize| ((b[i] - b'0') * 10 + (b[i + 1] - b'0')) as u32;
    let (h1, m1, h2, m2) = (n(0), n(3), n(6), n(9));
    if h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59 {
        return None;
    }
    let (s, t) = (h1 * 60 + m1, h2 * 60 + m2);
    if t <= s {
        return None;
    }
    Some((s, t))
}

pub fn schedule(s: &str) -> String {
    let mut r: Vec<(u32, u32)> = Vec::new();
    let mut invalid = 0;
    if !s.is_empty() {
        for e in s.split(',') {
            match sc_parse(e) {
                Some(x) => r.push(x),
                None => invalid += 1,
            }
        }
    }
    r.sort();
    let mut m: Vec<(u32, u32)> = Vec::new();
    for (a, b) in r {
        if let Some(l) = m.last_mut() {
            if a <= l.1 {
                if b > l.1 {
                    l.1 = b;
                }
                continue;
            }
        }
        m.push((a, b));
    }
    let total: u32 = m.iter().map(|x| x.1 - x.0).sum();
    let parts: Vec<String> = m
        .iter()
        .map(|&(a, b)| format!("{:02}:{:02}-{:02}:{:02}", a / 60, a % 60, b / 60, b % 60))
        .collect();
    format!("{};total={};invalid={}", parts.join(","), total, invalid)
}
