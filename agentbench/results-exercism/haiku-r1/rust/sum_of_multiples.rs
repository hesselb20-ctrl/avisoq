pub fn sum_of_multiples(factors: &[i64], limit: i64) -> i64 {
    let mut multiples: Vec<i64> = Vec::new();
    for &f in factors {
        if f <= 0 {
            continue;
        }
        let mut m = f;
        while m < limit {
            multiples.push(m);
            m += f;
        }
    }
    multiples.sort_unstable();
    multiples.dedup();
    multiples.iter().sum()
}
