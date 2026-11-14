pub fn is_palindrome(s: &str) -> bool {
    let c: Vec<char> = s.chars().collect();
    let n = c.len();
    for i in 0..n / 2 {
        if c[i] != c[n - 1 - i] {
            return false;
        }
    }
    true
}
