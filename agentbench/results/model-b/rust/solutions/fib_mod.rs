pub fn fib_mod(n: i64) -> i64 {
    const MODULUS: u64 = 1_000_000_007;
    let mut a: u64 = 0; // fib(0)
    let mut b: u64 = 1; // fib(1)
    let mut i: i64 = 0;
    while i < n {
        let next = (a + b) % MODULUS;
        a = b;
        b = next;
        i += 1;
    }
    a as i64
}
