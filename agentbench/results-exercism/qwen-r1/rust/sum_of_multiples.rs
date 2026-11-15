pub fn sum_of_multiples(factors: &[i64], limit: i64) -> i64 {
    if limit <= 1 {
        return 0;
    }

    let mut normalized: Vec<i64> = factors
        .iter()
        .filter(|&&f| f > 0)
        .map(|&f| f)
        .collect();

    normalized.sort_unstable();
    normalized.dedup();

    let mut result: i64 = 0;
    let n = normalized.len();

    for mask in 1..(1usize << n) {
        let mut lcm: i64 = 1;
        let mut bits = 0usize;

        for i in 0..n {
            if mask & (1 << i) != 0 {
                bits += 1;
                let f = normalized[i];
                let g = gcd(lcm, f);
                let a = lcm / g;

                if a > limit / f {
                    lcm = limit;
                    break;
                }

                lcm = a * f;
            }
        }

        if lcm >= limit {
            continue;
        }

        let count = (limit - 1) / lcm;
        let sum = lcm * count * (count + 1) / 2;

        if bits % 2 == 1 {
            result += sum;
        } else {
            result -= sum;
        }
    }

    result
}

fn gcd(mut a: i64, mut b: i64) -> i64 {
    while b != 0 {
        let t = a % b;
        a = b;
        b = t;
    }
    a
}
