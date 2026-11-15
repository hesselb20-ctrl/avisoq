pub fn transpose(lines: &[&str]) -> Vec<String> {
    let grid: Vec<Vec<char>> = lines.iter().map(|l| l.chars().collect()).collect();
    let max_len = grid.iter().map(|row| row.len()).max().unwrap_or(0);

    let mut out = Vec::with_capacity(max_len);
    for j in 0..max_len {
        // Only rows up to the last input line that reaches column j are emitted,
        // so nothing is padded on the right. Shorter lines are padded with spaces.
        let mut s = String::new();
        if let Some(last) = grid.iter().rposition(|row| row.len() > j) {
            for row in &grid[..=last] {
                s.push(row.get(j).copied().unwrap_or(' '));
            }
        }
        out.push(s);
    }
    out
}
