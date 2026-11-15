fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = (if y >= 0 { y } else { y - 399 }) / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

fn dow(y: i64, m: i64, d: i64) -> i64 {
    // 0 = Monday (1970-01-01 was Thursday)
    (days_from_civil(y, m, d) + 3).rem_euclid(7)
}

fn dim(y: i64, m: i64) -> i64 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        _ => if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 { 29 } else { 28 },
    }
}

pub fn meetup(year: i64, month: i64, week: &str, dayofweek: &str) -> String {
    let target = match dayofweek.to_lowercase().as_str() {
        "monday" => 0, "tuesday" => 1, "wednesday" => 2, "thursday" => 3,
        "friday" => 4, "saturday" => 5, _ => 6,
    };
    let n = dim(year, month);
    let days: Vec<i64> = (1..=n).filter(|&d| dow(year, month, d) == target).collect();
    let day = match week.to_lowercase().as_str() {
        "first" => days[0],
        "second" => days[1],
        "third" => days[2],
        "fourth" => days[3],
        "fifth" => days[4],
        "last" => *days.last().unwrap(),
        _ => *days.iter().find(|&&d| (13..=19).contains(&d)).unwrap(),
    };
    format!("{:04}-{:02}-{:02}", year, month, day)
}
