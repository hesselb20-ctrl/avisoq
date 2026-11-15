pub fn transpose(lines: &[&str]) -> Vec<String> {
    let rows: Vec<Vec<char>> = lines.iter().map(|l| l.chars().collect()).collect();
    let maxw = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    let mut out = Vec::new();
    for j in 0..maxw {
        let last = rows.iter().rposition(|r| r.len() > j).unwrap();
        let mut s = String::new();
        for i in 0..=last {
            s.push(if rows[i].len() > j { rows[i][j] } else { ' ' });
        }
        out.push(s);
    }
    out
}
