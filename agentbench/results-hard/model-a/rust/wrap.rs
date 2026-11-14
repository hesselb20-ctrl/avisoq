pub fn wrap(s: &str, width: i64) -> String {
    let w = width as usize;
    let mut lines: Vec<String> = vec![];
    let mut cur = String::new(); let mut cl = 0usize;
    for word in s.split(' ').filter(|x| !x.is_empty()) {
        let chars: Vec<char> = word.chars().collect();
        for piece in chars.chunks(w) {
            let p: String = piece.iter().collect();
            let pl = piece.len();
            if cl == 0 { cur = p; cl = pl; }
            else if cl + 1 + pl <= w { cur.push(' '); cur.push_str(&p); cl += 1 + pl; }
            else { lines.push(std::mem::take(&mut cur)); cur = p; cl = pl; }
        }
    }
    if cl > 0 { lines.push(cur); }
    lines.join("|")
}
