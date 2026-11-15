fn meetup_dow(y: i64, m: i64, d: i64) -> i64 {
    // 0 = Monday
    let t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let yy = if m < 3 { y - 1 } else { y };
    let w = (yy + yy / 4 - yy / 100 + yy / 400 + t[(m - 1) as usize] + d) % 7; // 0=Sunday
    (w + 6) % 7
}

fn meetup_dim(y: i64, m: i64) -> i64 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        _ => {
            if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 {
                29
            } else {
                28
            }
        }
    }
}

pub fn meetup(year: i64, month: i64, week: &str, dayofweek: &str) -> String {
    let target = match dayofweek.to_lowercase().as_str() {
        "monday" => 0,
        "tuesday" => 1,
        "wednesday" => 2,
        "thursday" => 3,
        "friday" => 4,
        "saturday" => 5,
        _ => 6,
    };
    let n = meetup_dim(year, month);
    let days: Vec<i64> = (1..=n).filter(|&d| meetup_dow(year, month, d) == target).collect();
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
