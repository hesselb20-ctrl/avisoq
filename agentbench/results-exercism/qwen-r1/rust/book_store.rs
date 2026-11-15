pub fn book_store(basket: &[i64]) -> i64 {
    let mut counts = [0i64; 5];

    for &book in basket {
        if (1..=5).contains(&book) {
            counts[(book - 1) as usize] += 1;
        }
    }

    counts.sort_unstable_by(|a, b| b.cmp(a));

    let mut total = 0i64;

    while counts[0] > 0 {
        let distinct = counts.iter().filter(|&&c| c > 0).count();

        if distinct == 5 && counts[0] - counts[1] >= 3 {
            for c in counts.iter_mut().take(4) {
                *c -= 1;
            }
            total += 4 * 640;
        } else {
            for c in counts.iter_mut().take(distinct) {
                *c -= 1;
            }
            total += match distinct {
                1 => 800,
                2 => 2 * 760,
                3 => 3 * 720,
                4 => 4 * 640,
                _ => 5 * 600,
            };
        }
    }

    total
}
