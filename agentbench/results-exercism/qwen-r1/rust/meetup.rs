pub fn meetup(year: i64, month: i64, week: &str, dayofweek: &str) -> String {
    let target = weekday_index(dayofweek);
    let first = day_of_week(year, month, 1);

    let day = match week {
        "first" => 1 + ((target - first + 7) % 7),
        "second" => 8 + ((target - first + 7) % 7),
        "third" => 15 + ((target - first + 7) % 7),
        "fourth" => 22 + ((target - first + 7) % 7),
        "teenth" => {
            let thirteenth = day_of_week(year, month, 13);
            13 + ((target - thirteenth + 7) % 7)
        }
        "last" => {
            let last_day = days_in_month(year, month);
            let last_dow = day_of_week(year, month, last_day);
            last_day - ((last_dow - target + 7) % 7)
        }
        _ => 1,
    };

    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn weekday_index(day: &str) -> i64 {
    match day {
        "Monday" => 1,
        "Tuesday" => 2,
        "Wednesday" => 3,
        "Thursday" => 4,
        "Friday" => 5,
        "Saturday" => 6,
        _ => 0,
    }
}

fn days_in_month(year: i64, month: i64) -> i64 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(year) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

fn is_leap_year(year: i64) -> bool {
    year % 400 == 0 || (year % 4 == 0 && year % 100 != 0)
}

fn day_of_week(year: i64, month: i64, day: i64) -> i64 {
    let mut y = year;
    if month < 3 {
        y -= 1;
    }

    let t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let m = (month - 1) as usize;

    (y + y / 4 - y / 100 + y / 400 + t[m] + day) % 7
}
