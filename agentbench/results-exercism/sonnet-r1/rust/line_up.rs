pub fn line_up(name: &str, number: i64) -> String {
    let m100 = number.abs() % 100;
    let suffix = if (11..=13).contains(&m100) {
        "th"
    } else {
        match number.abs() % 10 {
            1 => "st",
            2 => "nd",
            3 => "rd",
            _ => "th",
        }
    };
    format!("{}, you are the {}{} customer we serve today. Thank you!", name, number, suffix)
}
