use std::collections::VecDeque;

// Neighbours of (r, c) on the hex parallelogram (each row is shifted half a cell right).
const DELTAS: [(isize, isize); 6] = [(-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0)];

fn wins(grid: &[Vec<char>], p: char) -> bool {
    let rows = grid.len();
    let mut seen: Vec<Vec<bool>> = grid.iter().map(|r| vec![false; r.len()]).collect();
    let mut queue: VecDeque<(usize, usize)> = VecDeque::new();

    // Start cells: player's stones on their first side.
    for r in 0..rows {
        for c in 0..grid[r].len() {
            let is_start = if p == 'O' {
                r == 0
            } else {
                c == 0
            };
            if is_start && grid[r][c] == p {
                seen[r][c] = true;
                queue.push_back((r, c));
            }
        }
    }

    while let Some((r, c)) = queue.pop_front() {
        let at_goal = if p == 'O' {
            r == rows - 1
        } else {
            c == grid[r].len() - 1
        };
        if at_goal {
            return true;
        }
        for &(dr, dc) in DELTAS.iter() {
            let nr = r as isize + dr;
            let nc = c as isize + dc;
            if nr < 0 || nr >= rows as isize {
                continue;
            }
            let (nr, nc) = (nr as usize, nc as usize);
            if nc >= grid[nr].len() {
                continue;
            }
            if grid[nr][nc] == p && !seen[nr][nc] {
                seen[nr][nc] = true;
                queue.push_back((nr, nc));
            }
        }
    }
    false
}

pub fn connect(board: &[&str]) -> String {
    let grid: Vec<Vec<char>> = board
        .iter()
        .map(|line| line.chars().filter(|c| !c.is_whitespace()).collect())
        .collect();
    if grid.is_empty() {
        return String::new();
    }
    if wins(&grid, 'O') {
        return "O".to_string();
    }
    if wins(&grid, 'X') {
        return "X".to_string();
    }
    String::new()
}
