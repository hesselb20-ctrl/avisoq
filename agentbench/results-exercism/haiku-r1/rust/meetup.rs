const DAYS: [&str; 7] = [
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
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap(y) {
                29
            } else {
                28
            }
        }
        _ => panic!("invalid month"),
    }
}

// Day of week for a date: 0 = Sunday ... 6 = Saturday (Sakamoto's method).
fn weekday(y: i64, m: i64, d: i64) -> i64 {
    const T: [i64; 12] = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let y = if m < 3 { y - 1 } else { y };
    (y + y / 4 - y / 100 + y / 400 + T[(m - 1) as usize] + d).rem_euclid(7)
}

pub fn meetup(year: i64, month: i64, week: &str, dayofweek: &str) -> String {
    let target = DAYS
        .iter()
        .position(|&x| x.eq_ignore_ascii_case(dayofweek))
        .expect("unknown day of week") as i64;
    let dim = days_in_month(year, month);
    let first_wd = weekday(year, month, 1);
    // first occurrence of the target weekday in the month
    let first = 1 + (target - first_wd).rem_euclid(7);
    let day = match week {
        "first" => first,
        "second" => first + 7,
        "third" => first + 14,
        "fourth" => first + 21,
        "fifth" => first + 28,
        "last" => {
            let mut d = first;
            while d + 7 <= dim {
                d += 7;
            }
            d
        }
        "teenth" => {
            let mut d = first;
            while d < 13 {
                d += 7;
            }
            d
        }
        _ => panic!("unknown week"),
    };
    format!("{:04}-{:02}-{:02}", year, month, day)
}
