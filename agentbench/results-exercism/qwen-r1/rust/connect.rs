pub fn connect(board: &[&str]) -> String {
    let rows = board.len();
    if rows == 0 {
        return String::new();
    }

    let cols = board
        .iter()
        .map(|line| line.trim().split_whitespace().count())
        .max()
        .unwrap_or(0);

    if cols == 0 {
        return String::new();
    }

    let mut grid = vec![vec!['.'; cols]; rows];
    for (r, line) in board.iter().enumerate() {
        for (c, cell) in line.trim().split_whitespace().enumerate() {
            if c < cols {
                grid[r][c] = cell.chars().next().unwrap_or('.');
            }
        }
    }

    let neighbors = |r: usize, c: usize| -> Vec<(usize, usize)> {
        let mut v = Vec::new();
        if c > 0 {
            v.push((r, c - 1));
        }
        if c + 1 < cols {
            v.push((r, c + 1));
        }
        if r > 0 {
            if c > 0 {
                v.push((r - 1, c - 1));
            }
            v.push((r - 1, c));
        }
        if r + 1 < rows {
            v.push((r + 1, c));
            if c + 1 < cols {
                v.push((r + 1, c + 1));
            }
        }
        v
    };

    let connected =
        |target: char, start: &dyn Fn(usize) -> bool, finish: &dyn Fn(usize) -> bool| -> bool {
            let mut visited = vec![vec![false; cols]; rows];
            let mut stack = Vec::new();

            for c in 0..cols {
                if grid[0][c] == target && start(0) {
                    stack.push((0, c));
                    visited[0][c] = true;
                }
            }

            while let Some((r, c)) = stack.pop() {
                if finish(r) {
                    return true;
                }

                for (nr, nc) in neighbors(r, c) {
                    if !visited[nr][nc] && grid[nr][nc] == target {
                        visited[nr][nc] = true;
                        stack.push((nr, nc));
                    }
                }
            }

            false
        };

    if connected('O', &|_| true, &|r| r + 1 == rows) {
        return "O".to_string();
    }

    if connected('X', &|c| c == 0, &|c| c + 1 == cols) {
        return "X".to_string();
    }

    String::new()
}
