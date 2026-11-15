pub fn transpose(lines: &[&str]) -> Vec<String> {
    let rows: Vec<Vec<char>> = lines.iter().map(|l| l.chars().collect()).collect();
    let max_len = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    let mut out: Vec<String> = Vec::with_capacity(max_len);
    for col in 0..max_len {
        // Output row runs down to the last input row that still has a character in this column.
        let mut s = String::new();
        if let Some(last) = rows.iter().rposition(|r| col < r.len()) {
            for r in &rows[..=last] {
                s.push(if col < r.len() { r[col] } else { ' ' });
            }
        }
        out.push(s);
    }
    out
}
