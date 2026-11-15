pub fn wordy(question: &str) -> i64 {
    let question = question.trim();
    let question = question.strip_suffix('?').unwrap_or(question);

    let body = question
        .strip_prefix("What is ")
        .expect("not a math question");

    let tokens: Vec<&str> = body.split_whitespace().collect();
    if tokens.is_empty() {
        panic!("invalid syntax");
    }

    let mut result = parse_number(tokens[0]);
    let mut i = 1;

    while i < tokens.len() {
        let op = match tokens[i] {
            "plus" => {
                i += 1;
                Op::Add
            }
            "minus" => {
                i += 1;
                Op::Sub
            }
            "multiplied" => {
                i += 1;
                if i >= tokens.len() || tokens[i] != "by" {
                    panic!("invalid syntax");
                }
                i += 1;
                Op::Mul
            }
            "divided" => {
                i += 1;
                if i >= tokens.len() || tokens[i] != "by" {
                    panic!("invalid syntax");
                }
                i += 1;
                Op::Div
            }
            _ => panic!("unsupported operation"),
        };

        if i >= tokens.len() {
            panic!("invalid syntax");
        }

        let rhs = parse_number(tokens[i]);
        i += 1;

        result = match op {
            Op::Add => result + rhs,
            Op::Sub => result - rhs,
            Op::Mul => result * rhs,
            Op::Div => {
                if rhs == 0 {
                    panic!("division by zero");
                }
                result / rhs
            }
        };
    }

    result
}

#[derive(Debug, Clone, Copy)]
enum Op {
    Add,
    Sub,
    Mul,
    Div,
}

fn parse_number(token: &str) -> i64 {
    token
        .parse::<i64>()
        .expect("invalid number")
}
