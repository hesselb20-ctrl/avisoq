const ANIMALS: [&str; 8] = [
    "fly", "spider", "bird", "cat", "dog", "goat", "cow", "horse",
];

fn verse(n: usize) -> Vec<String> {
    let mut lines = vec![format!(
        "I know an old lady who swallowed a {}.",
        ANIMALS[n - 1]
    )];
    if n == 1 {
        lines.push("I don't know why she swallowed the fly. Perhaps she'll die.".to_string());
        return lines;
    }
    if n == 8 {
        lines.push("She's dead, of course!".to_string());
        return lines;
    }

    let aside = match n {
        2 => "It wriggled and jiggled and tickled inside her.",
        3 => "How absurd to swallow a bird!",
        4 => "Imagine that, to swallow a cat!",
        5 => "What a hog, to swallow a dog!",
        6 => "Just opened her throat and swallowed a goat!",
        _ => "I don't know how she swallowed a cow!",
    };
    lines.push(aside.to_string());

    for i in (2..=n).rev() {
        let mut line = format!(
            "She swallowed the {} to catch the {}",
            ANIMALS[i - 1],
            ANIMALS[i - 2]
        );
        if i - 2 == 1 {
            line.push_str(" that wriggled and jiggled and tickled inside her");
        }
        line.push('.');
        lines.push(line);
    }

    lines.push("I don't know why she swallowed the fly. Perhaps she'll die.".to_string());
    lines
}

pub fn food_chain(start_verse: i64, end_verse: i64) -> Vec<String> {
    if start_verse < 1 || end_verse > 8 || start_verse > end_verse {
        return Vec::new();
    }
    let mut lines = Vec::new();
    for n in start_verse..=end_verse {
        lines.extend(verse(n as usize));
    }
    lines
}
