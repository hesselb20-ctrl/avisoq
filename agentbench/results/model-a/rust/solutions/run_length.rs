pub fn run_length(s: &str) -> String {
    let mut out = String::new();
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        let mut n: usize = 1;
        while it.peek() == Some(&c) {
            it.next();
            n += 1;
        }
        out.push(c);
        out.push_str(&n.to_string());
    }
    out
}
