const ANIMALS: [&str; 8] = [
    "fly", "spider", "bird", "cat", "dog", "goat", "cow", "horse",
];

const FLY_LINE: &str = "I don't know why she swallowed the fly. Perhaps she'll die.";

pub fn food_chain(start_verse: i64, end_verse: i64) -> Vec<String> {
    let mut lines = Vec::new();
    if start_verse > end_verse {
        return lines;
    }
    for verse in start_verse..=end_verse {
        if !(1..=8).contains(&verse) {
            panic!("verse must be between 1 and 8");
        }
        let idx = (verse - 1) as usize;
        let animal = ANIMALS[idx];

        lines.push(format!("I know an old lady who swallowed a {}.", animal));

        let special = match animal {
            "fly" => FLY_LINE,
            "spider" => "It wriggled and jiggled and tickled inside her.",
            "bird" => "How absurd to swallow a bird!",
            "cat" => "Imagine that, to swallow a cat!",
            "dog" => "What a hog, to swallow a dog!",
            "goat" => "Just opened her throat and swallowed a goat!",
            "cow" => "I don't know how she swallowed a cow!",
            _ => "She's dead, of course!",
        };
        lines.push(special.to_string());

        if idx == 0 || idx == 7 {
            continue;
        }

        for j in (1..=idx).rev() {
            let mut line = format!(
                "She swallowed the {} to catch the {}",
                ANIMALS[j],
                ANIMALS[j - 1]
            );
            if j - 1 == 1 {
                line.push_str(" that wriggled and jiggled and tickled inside her");
            }
            line.push('.');
            lines.push(line);
        }
        lines.push(FLY_LINE.to_string());
    }
    lines
}
