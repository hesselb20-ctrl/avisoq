pub fn meetup(year: i64, month: i64, week: &str, dayofweek: &str) -> String {
    let target = match dayofweek {
        "Sunday" => 0,
        "Monday" => 1,
        "Tuesday" => 2,
        "Wednesday" => 3,
        "Thursday" => 4,
        "Friday" => 5,
        "Saturday" => 6,
        _ => panic!("unknown weekday"),
    };

    let dim = days_in_month(year, month);
    let matches: Vec<i64> = (1..=dim)
        .filter(|&d| weekday(year, month, d) == target)
        .collect();

    let day = match week {
        "first" => matches[0],
        "second" => matches[1],
        "third" => matches[2],
        "fourth" => matches[3],
        "fifth" => matches[4],
        "last" => *matches.last().unwrap(),
        "teenth" => *matches
            .iter()
            .find(|&&d| (13..=19).contains(&d))
            .unwrap(),
        _ => panic!("unknown week"),
    };

    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn is_leap(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn days_in_month(year: i64, month: i64) -> i64 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap(year) {
                29
            } else {
                28
            }
        }
        _ => panic!("invalid month"),
    }
}

// Day of week with 0 = Sunday (Sakamoto's method).
fn weekday(year: i64, month: i64, day: i64) -> i64 {
    const T: [i64; 12] = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let y = if month < 3 { year - 1 } else { year };
    (y + y.div_euclid(4) - y.div_euclid(100) + y.div_euclid(400) + T[(month - 1) as usize] + day)
        .rem_euclid(7)
}
