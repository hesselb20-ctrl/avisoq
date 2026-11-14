pub fn common_prefix(a: &str, b: &str) -> String {
    let mut out = String::new();
    for (x, y) in a.chars().zip(b.chars()) {
        if x != y {
            break;
        }
        out.push(x);
    }
    out
}
