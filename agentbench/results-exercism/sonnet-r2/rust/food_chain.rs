pub fn food_chain(start_verse: i64, end_verse: i64) -> Vec<String> {
    let animals = ["fly", "spider", "bird", "cat", "dog", "goat", "cow", "horse"];
    let extra = [
        "",
        "It wriggled and jiggled and tickled inside her.",
        "How absurd to swallow a bird!",
        "Imagine that, to swallow a cat!",
        "What a hog, to swallow a dog!",
        "Just opened her throat and swallowed a goat!",
        "I don't know how she swallowed a cow!",
        "She's dead, of course!",
    ];
    let mut out: Vec<String> = Vec::new();
    for v in start_verse..=end_verse {
        if v < 1 || v > 8 {
            continue;
        }
        let i = (v - 1) as usize;
        if !out.is_empty() {
            out.push(String::new());
        }
        out.push(format!("I know an old lady who swallowed a {}.", animals[i]));
        if i == 7 {
            out.push(extra[7].to_string());
            continue;
        }
        if i > 0 {
            out.push(extra[i].to_string());
        }
        for k in (1..=i).rev() {
            let tail = if k == 2 {
                " that wriggled and jiggled and tickled inside her"
            } else {
                ""
            };
            out.push(format!(
                "She swallowed the {} to catch the {}{}.",
                animals[k],
                animals[k - 1],
                tail
            ));
        }
        out.push("I don't know why she swallowed the fly. Perhaps she'll die.".to_string());
    }
    out
}
