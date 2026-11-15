pub fn transpose(lines: &[&str]) -> Vec<String> {
    let rows: Vec<Vec<char>> = lines.iter().map(|l| l.chars().collect()).collect();
    let width = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    let mut out = Vec::new();
    for j in 0..width {
        let last = (0..rows.len()).rev().find(|&i| rows[i].len() > j).unwrap();
        let mut s = String::new();
        for i in 0..=last {
            s.push(if rows[i].len() > j { rows[i][j] } else { ' ' });
        }
        out.push(s);
    }
    out
}
