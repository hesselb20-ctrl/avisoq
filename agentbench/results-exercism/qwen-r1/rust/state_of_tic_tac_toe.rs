pub fn state_of_tic_tac_toe(board: &[&str]) -> String {
    if board.len() != 3 {
        panic!("invalid board: expected 3 rows");
    }

    let mut cells = [0u8; 9];
    for (r, row) in board.iter().enumerate() {
        if row.len() != 3 {
            panic!("invalid board: each row must have exactly 3 characters");
        }

        for (c, ch) in row.chars().enumerate() {
            let cell = match ch {
                'X' => b'X',
                'O' => b'O',
                ' ' => b' ',
                _ => panic!("invalid board: unexpected character"),
            };
            cells[r * 3 + c] = cell;
        }
    }

    let x_count = cells.iter().filter(|&&c| c == b'X').count();
    let o_count = cells.iter().filter(|&&c| c == b'O').count();

    if o_count > x_count || x_count > o_count + 1 {
        panic!("invalid board: wrong turn order");
    }

    let lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    let mut x_wins = 0usize;
    let mut o_wins = 0usize;

    for line in lines.iter() {
        let a = cells[line[0]];
        let b = cells[line[1]];
        let c = cells[line[2]];

        if a == b && b == c {
            if a == b'X' {
                x_wins += 1;
            } else if a == b'O' {
                o_wins += 1;
            }
        }
    }

    if x_wins > 0 && o_wins > 0 {
        panic!("invalid board: both players cannot win");
    }

    if x_wins > 1 || o_wins > 1 {
        panic!("invalid board: game continued after a win");
    }

    if x_wins == 1 {
        if o_count != x_count - 1 {
            panic!("invalid board: game continued after a win");
        }
        return "win".to_string();
    }

    if o_wins == 1 {
        if x_count != o_count {
            panic!("invalid board: game continued after a win");
        }
        return "win".to_string();
    }

    if x_count + o_count == 9 {
        return "draw".to_string();
    }

    "ongoing".to_string()
}
