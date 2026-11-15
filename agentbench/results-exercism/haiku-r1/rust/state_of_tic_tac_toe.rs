fn has_win(g: &[[char; 3]; 3], p: char) -> bool {
    for i in 0..3 {
        if g[i][0] == p && g[i][1] == p && g[i][2] == p {
            return true;
        }
        if g[0][i] == p && g[1][i] == p && g[2][i] == p {
            return true;
        }
    }
    (g[0][0] == p && g[1][1] == p && g[2][2] == p)
        || (g[0][2] == p && g[1][1] == p && g[2][0] == p)
}

pub fn state_of_tic_tac_toe(board: &[&str]) -> String {
    if board.len() != 3 {
        panic!("invalid board");
    }
    let mut g = [[' '; 3]; 3];
    for (r, line) in board.iter().enumerate() {
        let cells: Vec<char> = line.chars().collect();
        if cells.len() != 3 {
            panic!("invalid board");
        }
        for c in 0..3 {
            let ch = cells[c];
            if ch != 'X' && ch != 'O' && ch != ' ' {
                panic!("invalid board");
            }
            g[r][c] = ch;
        }
    }

    let nx = g.iter().flat_map(|row| row.iter()).filter(|&&c| c == 'X').count();
    let no = g.iter().flat_map(|row| row.iter()).filter(|&&c| c == 'O').count();
    // X always starts, so X has either as many marks as O or one more.
    if nx != no && nx != no + 1 {
        panic!("invalid board: wrong turn order");
    }
    let x_win = has_win(&g, 'X');
    let o_win = has_win(&g, 'O');
    if x_win && o_win {
        panic!("invalid board: both players cannot win");
    }
    if x_win && nx != no + 1 {
        panic!("invalid board: X won but turn count is wrong");
    }
    if o_win && nx != no {
        panic!("invalid board: O won but turn count is wrong");
    }
    if x_win || o_win {
        "win".to_string()
    } else if nx + no == 9 {
        "draw".to_string()
    } else {
        "ongoing".to_string()
    }
}
