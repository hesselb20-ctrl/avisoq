pub fn food_chain(start_verse: i64, end_verse: i64) -> Vec<String> {
    const ANIMALS: [&str; 8] = [
        "fly",
        "spider",
        "bird",
        "cat",
        "dog",
        "goat",
        "cow",
        "horse",
    ];

    const COMMENTS: [&str; 8] = [
        "",
        "It wriggled and jiggled and tickled inside her.",
        "How absurd to swallow a bird!",
        "Imagine that, to swallow a cat!",
        "What a hog, to swallow a dog!",
        "Just opened her throat and swallowed a goat!",
        "I don't know how she swallowed a cow!",
        "She's dead, of course!",
    ];

    let mut lines: Vec<String> = Vec::new();

    for verse in start_verse.max(1)..=end_verse.min(8) {
        if !lines.is_empty() {
            lines.push(String::new());
        }

        let animal = ANIMALS[(verse - 1) as usize];
        lines.push(format!("I know an old lady who swallowed a {}.", animal));

        if verse == 8 {
            lines.push(COMMENTS[7].to_string());
            continue;
        }

        if verse > 1 {
            lines.push(COMMENTS[(verse - 1) as usize].to_string());
        }

        for i in (1..verse).rev() {
            let current = ANIMALS[i as usize];
            let previous = ANIMALS[(i - 1) as usize];

            if i == 2 {
                lines.push(format!(
                    "She swallowed the {} to catch the {} that wriggled and jiggled and tickled inside her.",
                    current, previous
                ));
            } else {
                lines.push(format!(
                    "She swallowed the {} to catch the {}.",
                    current, previous
                ));
            }
        }

        lines.push(
            "I don't know why she swallowed the fly. Perhaps she'll die."
                .to_string(),
        );
    }

    lines
}
