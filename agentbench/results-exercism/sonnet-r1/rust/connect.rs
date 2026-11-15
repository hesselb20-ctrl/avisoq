pub fn connect(board: &[&str]) -> String {
    let g: Vec<Vec<char>> = board
        .iter()
        .map(|l| l.chars().filter(|c| !c.is_whitespace()).collect())
        .collect();
    let h = g.len();
    if h == 0 || g[0].is_empty() {
        return String::new();
    }
    for &p in &['X', 'O'] {
        let mut seen: Vec<Vec<bool>> = g.iter().map(|r| vec![false; r.len()]).collect();
        let mut stack: Vec<(i64, i64)> = Vec::new();
        if p == 'X' {
            for r in 0..h {
                if !g[r].is_empty() && g[r][0] == 'X' {
                    seen[r][0] = true;
                    stack.push((r as i64, 0));
                }
            }
        } else {
            for c in 0..g[0].len() {
                if g[0][c] == 'O' {
                    seen[0][c] = true;
                    stack.push((0, c as i64));
                }
            }
        }
        while let Some((r, c)) = stack.pop() {
            if p == 'X' && c as usize == g[r as usize].len() - 1 {
                return "X".to_string();
            }
            if p == 'O' && r as usize == h - 1 {
                return "O".to_string();
            }
            for (dr, dc) in [(0i64, 1i64), (0, -1), (-1, 0), (-1, 1), (1, 0), (1, -1)] {
                let (nr, nc) = (r + dr, c + dc);
                if nr < 0 || nc < 0 || nr as usize >= h || nc as usize >= g[nr as usize].len() {
                    continue;
                }
                if g[nr as usize][nc as usize] == p && !seen[nr as usize][nc as usize] {
                    seen[nr as usize][nc as usize] = true;
                    stack.push((nr, nc));
                }
            }
        }
    }
    String::new()
}
