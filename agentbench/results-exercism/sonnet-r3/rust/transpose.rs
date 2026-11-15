pub fn transpose(lines: &[&str]) -> Vec<String> {
    let rows: Vec<Vec<char>> = lines.iter().map(|l| l.chars().collect()).collect();
    let w = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    let mut out = Vec::new();
    for j in 0..w {
        let mut last = 0;
        for (i, r) in rows.iter().enumerate() { if j < r.len() { last = i; } }
        let mut s = String::new();
        for i in 0..=last {
            s.push(if j < rows[i].len() { rows[i][j] } else { ' ' });
        }
        out.push(s);
    }
    out
}
