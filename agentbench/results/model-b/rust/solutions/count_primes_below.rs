pub fn count_primes_below(n: i64) -> i64 {
    if n <= 2 {
        return 0;
    }
    let limit = n as usize;
    let mut is_composite: Vec<bool> = vec![false; limit];
    let mut count: i64 = 0;
    for i in 2..limit {
        if !is_composite[i] {
            count += 1;
            let mut j = i * i;
            while j < limit {
                is_composite[j] = true;
                j += i;
            }
        }
    }
    count
}
