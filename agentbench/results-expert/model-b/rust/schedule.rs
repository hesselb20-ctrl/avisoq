fn parse_range(e: &str) -> Option<(u32, u32)> {
    let b = e.as_bytes();
    if b.len() != 11 {
        return None;
    }
    if b[2] != b':' || b[5] != b'-' || b[8] != b':' {
        return None;
    }
    let num2 = |i: usize| -> Option<u32> {
        let x = *b.get(i)?;
        let y = *b.get(i + 1)?;
        if x.is_ascii_digit() && y.is_ascii_digit() {
            Some(((x - b'0') as u32) * 10 + (y - b'0') as u32)
        } else {
            None
        }
    };
    let sh = num2(0)?;
    let sm = num2(3)?;
    let eh = num2(6)?;
    let em = num2(9)?;
    if sh > 23 || eh > 23 || sm > 59 || em > 59 {
        return None;
    }
    let start = sh * 60 + sm;
    let end = eh * 60 + em;
    if end <= start {
        return None;
    }
    Some((start, end))
}

pub fn schedule(s: &str) -> String {
    let mut ranges: Vec<(u32, u32)> = Vec::new();
    let mut invalid = 0u32;
    if !s.is_empty() {
        for ent in s.split(',') {
            match parse_range(ent) {
                Some(r) => ranges.push(r),
                None => invalid += 1,
            }
        }
    }
    ranges.sort();
    let mut merged: Vec<(u32, u32)> = Vec::new();
    for (st, en) in ranges {
        if let Some(last) = merged.last_mut() {
            if st <= last.1 {
                if en > last.1 {
                    last.1 = en;
                }
                continue;
            }
        }
        merged.push((st, en));
    }
    let total: u32 = merged.iter().map(|&(st, en)| en - st).sum();
    let parts: Vec<String> = merged
        .iter()
        .map(|&(st, en)| format!("{:02}:{:02}-{:02}:{:02}", st / 60, st % 60, en / 60, en % 60))
        .collect();
    format!("{};total={};invalid={}", parts.join(","), total, invalid)
}
