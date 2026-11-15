pub fn line_up(name: &str, number: i64) -> String {
    let last_two = number.abs() % 100;
    let suffix = if (11..=13).contains(&last_two) {
        "th"
    } else {
        match number.abs() % 10 {
            1 => "st",
            2 => "nd",
            3 => "rd",
            _ => "th",
        }
    };
    format!(
        "{}, you are the {}{} customer we serve today. Thank you!",
        name, number, suffix
    )
}
