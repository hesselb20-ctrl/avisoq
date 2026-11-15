pub fn state_of_tic_tac_toe(board: &[&str]) -> String {
    let g: Vec<Vec<char>> = board.iter().map(|r| r.chars().collect()).collect();
    let mut x = 0; let mut o = 0; let mut empty = 0;
    for r in &g { for &c in r { match c { 'X' => x += 1, 'O' => o += 1, _ => empty += 1 } } }
    if o > x || x > o + 1 { return "invalid".to_string(); }
    let at = |i: usize, j: usize| -> char { g.get(i).and_then(|r| r.get(j)).copied().unwrap_or(' ') };
    let mut lines: Vec<[(usize, usize); 3]> = Vec::new();
    for i in 0..3 {
        lines.push([(i, 0), (i, 1), (i, 2)]);
        lines.push([(0, i), (1, i), (2, i)]);
    }
    lines.push([(0, 0), (1, 1), (2, 2)]);
    lines.push([(0, 2), (1, 1), (2, 0)]);
    let wins = |p: char| lines.iter().any(|l| l.iter().all(|&(i, j)| at(i, j) == p));
    let xw = wins('X'); let ow = wins('O');
    if xw && ow { return "invalid".to_string(); }
    if xw && x != o + 1 { return "invalid".to_string(); }
    if ow && x != o { return "invalid".to_string(); }
    if xw || ow { return "win".to_string(); }
    if empty == 0 { "draw".to_string() } else { "ongoing".to_string() }
}
