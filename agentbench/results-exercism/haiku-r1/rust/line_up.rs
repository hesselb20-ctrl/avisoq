pub fn line_up(name: &str, number: i64) -> String {
    let suffix = if (11..=13).contains(&(number % 100)) {
        "th"
    } else {
        match number % 10 {
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
