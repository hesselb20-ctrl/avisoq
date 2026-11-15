pub fn connect(board: &[&str]) -> String {
    let g: Vec<Vec<char>> = board.iter()
        .map(|r| r.chars().filter(|c| !c.is_whitespace()).collect::<Vec<char>>())
        .filter(|r| !r.is_empty())
        .collect();
    let h = g.len();
    if h == 0 { return String::new(); }
    for &p in &['X', 'O'] {
        let mut seen: Vec<Vec<bool>> = g.iter().map(|r| vec![false; r.len()]).collect();
        let mut stack: Vec<(usize, usize)> = Vec::new();
        if p == 'X' {
            for i in 0..h { if g[i][0] == 'X' { seen[i][0] = true; stack.push((i, 0)); } }
        } else {
            for j in 0..g[0].len() { if g[0][j] == 'O' { seen[0][j] = true; stack.push((0, j)); } }
        }
        while let Some((i, j)) = stack.pop() {
            if p == 'X' && j == g[i].len() - 1 { return "X".to_string(); }
            if p == 'O' && i == h - 1 { return "O".to_string(); }
            for (di, dj) in [(0i64, -1i64), (0, 1), (-1, 0), (-1, 1), (1, 0), (1, -1)] {
                let ni = i as i64 + di;
                let nj = j as i64 + dj;
                if ni < 0 || nj < 0 || ni >= h as i64 { continue; }
                let (ni, nj) = (ni as usize, nj as usize);
                if nj >= g[ni].len() || seen[ni][nj] || g[ni][nj] != p { continue; }
                seen[ni][nj] = true;
                stack.push((ni, nj));
            }
        }
    }
    String::new()
}
