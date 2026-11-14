pub fn collatz_steps(n: i64) -> i64 {
    let mut x: i128 = n as i128;
    let mut steps: i64 = 0;
    while x != 1 {
        x = if x % 2 == 0 { x / 2 } else { 3 * x + 1 };
        steps += 1;
    }
    steps
}
