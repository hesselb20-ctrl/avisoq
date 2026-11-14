pub fn longest_valid(s: &str) -> i64 {
    let b = s.as_bytes();
    let mut st: Vec<i64> = vec![-1];
    let mut best = 0i64;
    for (i, &c) in b.iter().enumerate() {
        let i = i as i64;
        if c == b'(' || c == b'[' || c == b'{' { st.push(i); continue; }
        let open = match c { b')' => b'(', b']' => b'[', _ => b'{' };
        let top = *st.last().unwrap();
        if top >= 0 && b[top as usize] == open {
            st.pop();
            best = best.max(i - *st.last().unwrap());
        } else { st.clear(); st.push(i); }
    }
    best
}
