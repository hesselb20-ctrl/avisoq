pub fn wrap(s: &str, width: i64) -> String {
    let w = width.max(1) as usize;
    let mut words: Vec<String> = Vec::new();
    for word in s.split(' ').filter(|x| !x.is_empty()) {
        let chars: Vec<char> = word.chars().collect();
        for chunk in chars.chunks(w) {
            words.push(chunk.iter().collect());
        }
    }
    let mut lines: Vec<String> = Vec::new();
    let mut cur = String::new();
    let mut cur_len = 0usize;
    for word in words {
        let wl = word.chars().count();
        if cur_len == 0 {
            cur = word;
            cur_len = wl;
        } else if cur_len + 1 + wl <= w {
            cur.push(' ');
            cur.push_str(&word);
            cur_len += 1 + wl;
        } else {
            lines.push(std::mem::take(&mut cur));
            cur = word;
            cur_len = wl;
        }
    }
    if cur_len > 0 {
        lines.push(cur);
    }
    lines.join("|")
}
