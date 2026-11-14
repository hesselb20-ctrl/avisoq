pub fn balanced(s: &str) -> bool {
    let mut stack: Vec<char> = Vec::new();
    for c in s.chars() {
        match c {
            '(' | '[' | '{' => stack.push(c),
            ')' | ']' | '}' => {
                let expected = match c {
                    ')' => '(',
                    ']' => '[',
                    _ => '{',
                };
                match stack.pop() {
                    Some(open) if open == expected => {}
                    _ => return false,
                }
            }
            _ => {}
        }
    }
    stack.is_empty()
}
