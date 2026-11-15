pub fn transpose(lines: &[&str]) -> Vec<String> {
    if lines.is_empty() {
        return Vec::new();
    }

    let max_len = lines.iter().map(|line| line.len()).max().unwrap_or(0);
    let mut result = Vec::with_capacity(max_len);

    for col in 0..max_len {
        let mut row = String::new();

        for line in lines {
            let ch = line
                .chars()
                .nth(col)
                .unwrap_or(' ');
            row.push(ch);
        }

        while row.ends_with(' ') {
            row.pop();
        }

        result.push(row);
    }

    result
}
