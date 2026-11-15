pub fn sum_of_multiples(factors: &[i64], limit: i64) -> i64 {
    let mut sum = 0i64;
    let mut n = 1i64;
    while n < limit {
        if factors.iter().any(|&f| f > 0 && n % f == 0) {
            sum += n;
        }
        n += 1;
    }
    sum
}
