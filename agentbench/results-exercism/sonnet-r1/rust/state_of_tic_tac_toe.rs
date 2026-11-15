pub fn state_of_tic_tac_toe(board: &[&str]) -> String {
    let g: Vec<Vec<char>> = board.iter().map(|l| l.chars().collect()).collect();
    let invalid = || "invalid".to_string();
    if g.len() != 3 || g.iter().any(|r| r.len() != 3) {
        return invalid();
    }
    let mut x = 0;
    let mut o = 0;
    for r in &g {
        for &c in r {
            match c {
                'X' => x += 1,
                'O' => o += 1,
                _ => {}
            }
        }
    }
    if o > x || x > o + 1 {
        return invalid();
    }
    let lines = [
        [(0, 0), (0, 1), (0, 2)],
        [(1, 0), (1, 1), (1, 2)],
        [(2, 0), (2, 1), (2, 2)],
        [(0, 0), (1, 0), (2, 0)],
        [(0, 1), (1, 1), (2, 1)],
        [(0, 2), (1, 2), (2, 2)],
        [(0, 0), (1, 1), (2, 2)],
        [(0, 2), (1, 1), (2, 0)],
    ];
    let wins = |p: char| lines.iter().any(|l| l.iter().all(|&(r, c)| g[r][c] == p));
    let xw = wins('X');
    let ow = wins('O');
    if xw && ow {
        return invalid();
    }
    if xw && x != o + 1 {
        return invalid();
    }
    if ow && x != o {
        return invalid();
    }
    if xw || ow {
        return "win".to_string();
    }
    if x + o == 9 {
        "draw".to_string()
    } else {
        "ongoing".to_string()
    }
}
