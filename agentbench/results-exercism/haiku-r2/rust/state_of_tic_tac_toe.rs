pub fn state_of_tic_tac_toe(board: &[&str]) -> String {
    if board.len() != 3 || board.iter().any(|row| row.chars().count() != 3) {
        panic!("board must be 3x3");
    }

    let mut grid = [[' '; 3]; 3];
    let mut x_count: i64 = 0;
    let mut o_count: i64 = 0;
    for (r, row) in board.iter().enumerate() {
        for (c, ch) in row.chars().enumerate() {
            match ch {
                'X' => x_count += 1,
                'O' => o_count += 1,
                ' ' => {}
                _ => panic!("invalid cell"),
            }
            grid[r][c] = ch;
        }
    }

    // X always starts, so X has either as many marks as O, or one more.
    if !(x_count == o_count || x_count == o_count + 1) {
        panic!("wrong turn order");
    }

    let lines: [[(usize, usize); 3]; 8] = [
        [(0, 0), (0, 1), (0, 2)],
        [(1, 0), (1, 1), (1, 2)],
        [(2, 0), (2, 1), (2, 2)],
        [(0, 0), (1, 0), (2, 0)],
        [(0, 1), (1, 1), (2, 1)],
        [(0, 2), (1, 2), (2, 2)],
        [(0, 0), (1, 1), (2, 2)],
        [(0, 2), (1, 1), (2, 0)],
    ];
    let has_line = |p: char| {
        lines
            .iter()
            .any(|line| line.iter().all(|&(r, c)| grid[r][c] == p))
    };
    let x_won = has_line('X');
    let o_won = has_line('O');

    if x_won && o_won {
        panic!("both players cannot have won");
    }
    if x_won && x_count != o_count + 1 {
        panic!("X won but the turn order is wrong");
    }
    if o_won && x_count != o_count {
        panic!("O won but the turn order is wrong");
    }

    if x_won || o_won {
        "win".to_string()
    } else if x_count + o_count == 9 {
        "draw".to_string()
    } else {
        "ongoing".to_string()
    }
}
