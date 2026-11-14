pub fn longest_valid(s: &str) -> i64 {
    let b = s.as_bytes();
    // Stack of indices; the bottom sentinel -1 marks the start before the current run.
    let mut stack: Vec<i64> = vec![-1];
    let mut best: i64 = 0;
    for (i, &c) in b.iter().enumerate() {
        let i = i as i64;
        match c {
            b'(' | b'[' | b'{' => stack.push(i),
            _ => {
                let top = *stack.last().unwrap();
                let matched = top >= 0 && {
                    let o = b[top as usize];
                    (o == b'(' && c == b')') || (o == b'[' && c == b']') || (o == b'{' && c == b'}')
                };
                if matched {
                    stack.pop();
                    let base = *stack.last().unwrap();
                    best = best.max(i - base);
                } else {
                    stack.push(i);
                }
            }
        }
    }
    best
}
