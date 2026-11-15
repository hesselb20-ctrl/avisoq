use std::collections::VecDeque;

pub fn connect(board: &[&str]) -> String {
    let grid: Vec<Vec<char>> = board
        .iter()
        .map(|row| row.chars().filter(|c| !c.is_whitespace()).collect())
        .collect();
    if grid.is_empty() {
        return String::new();
    }

    for player in ['O', 'X'] {
        if player_wins(&grid, player) {
            return player.to_string();
        }
    }
    String::new()
}

// 'O' connects the top row to the bottom row; 'X' connects the left column to the right column.
// Neighbours in the skewed hex layout: same row +-1 column, previous row (0, +1) and (-1, 0)...
// written here as (row offset, column offset).
fn player_wins(grid: &[Vec<char>], player: char) -> bool {
    let nrows = grid.len();
    let width = grid.iter().map(|r| r.len()).max().unwrap_or(0);
    let neighbours: [(isize, isize); 6] = [(0, -1), (0, 1), (-1, 0), (-1, 1), (1, -1), (1, 0)];

    let mut seen: Vec<Vec<bool>> = grid.iter().map(|row| vec![false; row.len()]).collect();
    let mut queue = VecDeque::new();

    for r in 0..nrows {
        for c in 0..grid[r].len() {
            let on_start_edge = if player == 'O' { r == 0 } else { c == 0 };
            if on_start_edge && grid[r][c] == player {
                seen[r][c] = true;
                queue.push_back((r, c));
            }
        }
    }

    while let Some((r, c)) = queue.pop_front() {
        let on_goal_edge = if player == 'O' {
            r == nrows - 1
        } else {
            c == width - 1
        };
        if on_goal_edge {
            return true;
        }
        for &(dr, dc) in &neighbours {
            let nr = r as isize + dr;
            let nc = c as isize + dc;
            if nr < 0 || nc < 0 {
                continue;
            }
            let (nr, nc) = (nr as usize, nc as usize);
            if nr >= nrows || nc >= grid[nr].len() {
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
