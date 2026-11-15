use std::collections::VecDeque;

// Hex neighbours in a parallelogram where each row is shifted right by half a cell.
const OFFSETS: [(isize, isize); 6] = [(0, -1), (0, 1), (-1, 0), (-1, 1), (1, 0), (1, -1)];

fn reaches<G>(grid: &[Vec<char>], player: char, starts: Vec<(usize, usize)>, goal: G) -> bool
where
    G: Fn(usize, usize) -> bool,
{
    let mut seen: Vec<Vec<bool>> = grid.iter().map(|row| vec![false; row.len()]).collect();
    let mut queue = VecDeque::new();
    for (r, c) in starts {
        if grid[r].get(c) == Some(&player) && !seen[r][c] {
            seen[r][c] = true;
            queue.push_back((r, c));
        }
    }
    while let Some((r, c)) = queue.pop_front() {
        if goal(r, c) {
            return true;
        }
        for (dr, dc) in OFFSETS.iter() {
            let nr = r as isize + dr;
            let nc = c as isize + dc;
            if nr < 0 || nc < 0 {
                continue;
            }
            let (nr, nc) = (nr as usize, nc as usize);
            if nr >= grid.len() || nc >= grid[nr].len() {
                continue;
            }
            if grid[nr][nc] == player && !seen[nr][nc] {
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
    let rows = grid.len();
    if rows == 0 {
        return String::new();
    }

    // O: top row to bottom row.
    let o_starts: Vec<(usize, usize)> = (0..grid[0].len()).map(|c| (0, c)).collect();
    if reaches(&grid, 'O', o_starts, |r, _| r == rows - 1) {
        return "O".to_string();
    }

    // X: left edge to right edge (last cell of each row).
    let x_starts: Vec<(usize, usize)> = (0..rows).map(|r| (r, 0)).collect();
    let row_lens: Vec<usize> = grid.iter().map(|row| row.len()).collect();
    if reaches(&grid, 'X', x_starts, |r, c| c + 1 == row_lens[r]) {
        return "X".to_string();
    }

    String::new()
}
