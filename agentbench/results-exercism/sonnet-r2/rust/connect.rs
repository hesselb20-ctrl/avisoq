pub fn connect(board: &[&str]) -> String {
    let g: Vec<Vec<char>> = board
        .iter()
        .map(|l| l.chars().filter(|c| !c.is_whitespace()).collect())
        .collect();
    let h = g.len();
    if h == 0 {
        return String::new();
    }
    let w = g.iter().map(|r| r.len()).max().unwrap_or(0);
    if w == 0 {
        return String::new();
    }
    let get = |r: i64, c: i64| -> char {
        if r < 0 || c < 0 || r as usize >= h || c as usize >= g[r as usize].len() {
            '.'
        } else {
            g[r as usize][c as usize]
        }
    };
    for &player in &['O', 'X'] {
        let mut seen = vec![vec![false; w]; h];
        let mut stack: Vec<(i64, i64)> = Vec::new();
        if player == 'O' {
            for c in 0..w as i64 {
                if get(0, c) == 'O' {
                    stack.push((0, c));
                    seen[0][c as usize] = true;
                }
            }
        } else {
            for r in 0..h as i64 {
                if get(r, 0) == 'X' {
                    stack.push((r, 0));
                    seen[r as usize][0] = true;
                }
            }
        }
        while let Some((r, c)) = stack.pop() {
            if player == 'O' && r == h as i64 - 1 {
                return "O".to_string();
            }
            if player == 'X' && c == g[r as usize].len() as i64 - 1 {
                return "X".to_string();
            }
            for (dr, dc) in [(0i64, -1i64), (0, 1), (-1, 0), (-1, 1), (1, 0), (1, -1)] {
                let (nr, nc) = (r + dr, c + dc);
                if get(nr, nc) == player && !seen[nr as usize][nc as usize] {
                    seen[nr as usize][nc as usize] = true;
                    stack.push((nr, nc));
                }
            }
        }
    }
    String::new()
}
