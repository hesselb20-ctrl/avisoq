const ANIMALS: [&str; 8] = ["fly", "spider", "bird", "cat", "dog", "goat", "cow", "horse"];
const FINAL_LINE: &str = "I don't know why she swallowed the fly. Perhaps she'll die.";

fn verse_lines(n: usize) -> Vec<String> {
    let i = n - 1;
    let mut lines = vec![format!("I know an old lady who swallowed a {}.", ANIMALS[i])];
    if i == 7 {
        lines.push("She's dead, of course!".to_string());
        return lines;
    }
    if i == 0 {
        lines.push(FINAL_LINE.to_string());
        return lines;
    }
    let comment = match i {
        1 => "It wriggled and jiggled and tickled inside her.",
        2 => "How absurd to swallow a bird!",
        3 => "Imagine that, to swallow a cat!",
        4 => "What a hog, to swallow a dog!",
        5 => "Just opened her throat and swallowed a goat!",
        _ => "I don't know how she swallowed a cow!",
    };
    lines.push(comment.to_string());
    for j in (1..=i).rev() {
        let prey = ANIMALS[j];
        let next = ANIMALS[j - 1];
        let suffix = if next == "spider" {
            " that wriggled and jiggled and tickled inside her"
        } else {
            ""
        };
        lines.push(format!("She swallowed the {} to catch the {}{}.", prey, next, suffix));
    }
    lines.push(FINAL_LINE.to_string());
    lines
}

pub fn food_chain(start_verse: i64, end_verse: i64) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    if start_verse > end_verse {
        return out;
    }
    for v in start_verse..=end_verse {
        if !(1..=8).contains(&v) {
            panic!("verse must be between 1 and 8");
        }
        if v > start_verse {
            out.push(String::new());
        }
        out.extend(verse_lines(v as usize));
    }
    out
}
