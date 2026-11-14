pub fn fib_mod(n: i64) -> i64 {
    const M: i64 = 1_000_000_007;
    let mut a: i64 = 0;
    let mut b: i64 = 1;
    for _ in 0..n {
        let c = (a + b) % M;
        a = b;
        b = c;
    }
    a
}
