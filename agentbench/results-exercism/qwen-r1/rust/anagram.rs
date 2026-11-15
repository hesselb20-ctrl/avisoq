pub fn anagram(subject: &str, candidates: &[&str]) -> Vec<String> {
    let subject_lower = subject.to_ascii_lowercase();
    let subject_counts = letter_counts(&subject_lower);

    candidates
        .iter()
        .filter_map(|&candidate| {
            let candidate_lower = candidate.to_ascii_lowercase();

            if candidate_lower == subject_lower {
                return None;
            }

            if letter_counts(&candidate_lower) == subject_counts {
                Some(candidate.to_string())
            } else {
                None
            }
        })
        .collect()
}

fn letter_counts(word: &str) -> [u32; 26] {
    let mut counts = [0; 26];

    for byte in word.bytes() {
        if let Some(index) = ascii_letter_index(byte) {
            counts[index] += 1;
        }
    }

    counts
}

fn ascii_letter_index(byte: u8) -> Option<usize> {
    match byte {
        b'a'..=b'z' => Some((byte - b'a') as usize),
        b'A'..=b'Z' => Some((byte - b'A') as usize),
        _ => None,
    }
}
