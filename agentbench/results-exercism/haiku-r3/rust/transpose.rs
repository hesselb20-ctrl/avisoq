pub fn transpose(lines: &[&str]) -> Vec<String> {
    let grid: Vec<Vec<char>> = lines.iter().map(|l| l.chars().collect()).collect();
    let width = grid.iter().map(|row| row.len()).max().unwrap_or(0);

    let mut out = Vec::with_capacity(width);
    for j in 0..width {
        // Last input row that still has a character in column j.
        // Rows below it get no output; rows above it that are short are padded with spaces.
        let mut s = String::new();
        if let Some(last) = grid.iter().rposition(|row| j < row.len()) {
            for row in grid.iter().take(last + 1) {
                s.push(row.get(j).copied().unwrap_or(' '));
            }
        }
        out.push(s);
    }
    out
}
