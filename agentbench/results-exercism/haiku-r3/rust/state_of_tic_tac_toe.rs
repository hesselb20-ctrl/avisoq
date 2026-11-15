pub fn state_of_tic_tac_toe(board: &[&str]) -> String {
    if board.len() != 3 || board.iter().any(|row| row.chars().count() != 3) {
        panic!("board must be 3x3");
    }
    let grid: Vec<Vec<char>> = board.iter().map(|row| row.chars().collect()).collect();

    let mut x_count: i32 = 0;
    let mut o_count: i32 = 0;
    for row in &grid {
        for &c in row {
            match c {
                'X' => x_count += 1,
                'O' => o_count += 1,
                ' ' => {}
                _ => panic!("invalid cell"),
            }
        }
    }

    const LINES: [[(usize, usize); 3]; 8] = [
        [(0, 0), (0, 1), (0, 2)],
        [(1, 0), (1, 1), (1, 2)],
        [(2, 0), (2, 1), (2, 2)],
        [(0, 0), (1, 0), (2, 0)],
        [(0, 1), (1, 1), (2, 1)],
        [(0, 2), (1, 2), (2, 2)],
        [(0, 0), (1, 1), (2, 2)],
        [(0, 2), (1, 1), (2, 0)],
    ];
    let wins = |p: char| {
        LINES
            .iter()
            .any(|line| line.iter().all(|&(r, c)| grid[r][c] == p))
    };
    let x_wins = wins('X');
    let o_wins = wins('O');

    // X always starts, so X has either as many marks as O or one more.
    let turn_order_ok = x_count == o_count || x_count == o_count + 1;
    if !turn_order_ok {
        panic!("invalid board: wrong turn order");
    }
    if x_wins && o_wins {
        panic!("invalid board: both players cannot win");
    }
    if x_wins && x_count != o_count + 1 {
        panic!("invalid board: X won but turn count is wrong");
    }
    if o_wins && x_count != o_count {
        panic!("invalid board: O won but turn count is wrong");
    }

    if x_wins || o_wins {
        "win".to_string()
    } else if x_count + o_count == 9 {
        "draw".to_string()
    } else {
        "ongoing".to_string()
    }
}
