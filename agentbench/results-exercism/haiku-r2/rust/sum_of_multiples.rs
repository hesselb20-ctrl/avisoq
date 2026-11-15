pub fn sum_of_multiples(factors: &[i64], limit: i64) -> i64 {
    let usable: Vec<i64> = factors.iter().cloned().filter(|&f| f > 0).collect();
    let mut total: i64 = 0;
    let mut n: i64 = 1;
    while n < limit {
        if usable.iter().any(|&f| n % f == 0) {
            total += n;
        }
        n += 1;
    }
    total
}
