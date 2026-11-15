pub fn change(coins: &[i64], target: i64) -> Vec<i64> {
    if target < 0 {
        return Vec::new();
    }

    if target == 0 {
        return Vec::new();
    }

    let mut best = vec![i64::MAX; (target + 1) as usize];
    best[0] = 0;

    for coin in coins {
        if *coin <= 0 {
            continue;
        }

        let coin = *coin;
        let coin = coin as usize;

        for amount in coin..=target as usize {
            let prev = best[amount - coin];
            if prev + 1 < best[amount] {
                best[amount] = prev + 1;
            }
        }
    }

    if best[target as usize] == i64::MAX {
        return Vec::new();
    }

    let mut result = Vec::new();
    let mut remaining = target;

    while remaining > 0 {
        let mut chosen = None;

        for coin in coins {
            if *coin > 0 && *coin <= remaining {
                let prev = best[(remaining - *coin) as usize];
                if prev + 1 == best[remaining as usize] {
                    chosen = Some(*coin);
                    break;
                }
            }
        }

        match chosen {
            Some(coin) => {
                result.push(coin);
                remaining -= coin;
            }
            None => return Vec::new(),
        }
    }

    result.sort();
    result
}
