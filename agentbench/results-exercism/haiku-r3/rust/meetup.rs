const DAY_NAMES: [&str; 7] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn days_in_month(y: i64, m: i64) -> i64 {
    match m {
        2 => {
            if is_leap(y) {
                29
            } else {
                28
            }
        }
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

// 0 = Sunday ... 6 = Saturday (Sakamoto's method).
fn weekday(y: i64, m: i64, d: i64) -> i64 {
    const T: [i64; 12] = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let y = if m < 3 { y - 1 } else { y };
    (y + y.div_euclid(4) - y.div_euclid(100) + y.div_euclid(400) + T[(m - 1) as usize] + d)
        .rem_euclid(7)
}

pub fn meetup(year: i64, month: i64, week: &str, dayofweek: &str) -> String {
    let target = DAY_NAMES
        .iter()
        .position(|name| name.eq_ignore_ascii_case(dayofweek))
        .expect("unknown day of week") as i64;
    let dim = days_in_month(year, month);
    let matches = |d: i64| weekday(year, month, d) == target;

    let day = match week.to_ascii_lowercase().as_str() {
        "teenth" => (13..=19).find(|&d| matches(d)).unwrap(),
        "last" => (1..=dim).rev().find(|&d| matches(d)).unwrap(),
        "first" => (1..=dim).filter(|&d| matches(d)).nth(0).unwrap(),
        "second" => (1..=dim).filter(|&d| matches(d)).nth(1).unwrap(),
        "third" => (1..=dim).filter(|&d| matches(d)).nth(2).unwrap(),
        "fourth" => (1..=dim).filter(|&d| matches(d)).nth(3).unwrap(),
        _ => panic!("unknown week"),
    };
    format!("{:04}-{:02}-{:02}", year, month, day)
}
