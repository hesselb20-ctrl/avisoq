#[derive(Clone, Copy)]
enum Ins {
    Push(i64),
    Add,
    Sub,
    Mul,
    Dup,
    Swap,
    Pop,
    Out,
    Jmp(i64),
    Jz(i64),
    Halt,
    Nop,
}

fn parse_ins(seg: &str) -> Ins {
    let mut it = seg.split_whitespace();
    let op = it.next().unwrap_or("");
    let arg = it.next().and_then(|a| a.parse::<i64>().ok()).unwrap_or(0);
    match op {
        "push" => Ins::Push(arg),
        "add" => Ins::Add,
        "sub" => Ins::Sub,
        "mul" => Ins::Mul,
        "dup" => Ins::Dup,
        "swap" => Ins::Swap,
        "pop" => Ins::Pop,
        "out" => Ins::Out,
        "jmp" => Ins::Jmp(arg),
        "jz" => Ins::Jz(arg),
        "halt" => Ins::Halt,
        _ => Ins::Nop,
    }
}

pub fn stack_vm(program: &str) -> String {
    let prog: Vec<Ins> = if program.is_empty() {
        Vec::new()
    } else {
        program.split(';').map(|seg| parse_ins(seg.trim())).collect()
    };
    let n = prog.len() as i64;
    let mut stack: Vec<i64> = Vec::new();
    let mut out: Vec<String> = Vec::new();
    let mut pc: i64 = 0;
    let mut steps: u32 = 0;
    let mut err: Option<&str> = None;

    while pc >= 0 && pc < n {
        if steps == 1000 {
            err = Some("!steps");
            break;
        }
        steps += 1;
        let mut next = pc + 1;
        let need = |k: usize, st: &Vec<i64>| st.len() >= k;
        match prog[pc as usize] {
            Ins::Push(v) => stack.push(v),
            Ins::Add | Ins::Sub | Ins::Mul => {
                if !need(2, &stack) {
                    err = Some("!stack");
                    break;
                }
                let b = stack.pop().unwrap();
                let a = stack.pop().unwrap();
                let r = match prog[pc as usize] {
                    Ins::Add => a.wrapping_add(b),
                    Ins::Sub => a.wrapping_sub(b),
                    _ => a.wrapping_mul(b),
                };
                stack.push(r);
            }
            Ins::Dup => {
                if !need(1, &stack) {
                    err = Some("!stack");
                    break;
                }
                let t = *stack.last().unwrap();
                stack.push(t);
            }
            Ins::Swap => {
                if !need(2, &stack) {
                    err = Some("!stack");
                    break;
                }
                let l = stack.len();
                stack.swap(l - 1, l - 2);
            }
            Ins::Pop => {
                if !need(1, &stack) {
                    err = Some("!stack");
                    break;
                }
                stack.pop();
            }
            Ins::Out => {
                if !need(1, &stack) {
                    err = Some("!stack");
                    break;
                }
                out.push(stack.pop().unwrap().to_string());
            }
            Ins::Jmp(k) => {
                if k < 0 || k > n {
                    err = Some("!jump");
                    break;
                }
                next = k;
            }
            Ins::Jz(k) => {
                if !need(1, &stack) {
                    err = Some("!stack");
                    break;
                }
                let v = stack.pop().unwrap();
                if v == 0 {
                    if k < 0 || k > n {
                        err = Some("!jump");
                        break;
                    }
                    next = k;
                }
            }
            Ins::Halt => break,
            Ins::Nop => {}
        }
        pc = next;
    }

    if let Some(e) = err {
        out.push(e.to_string());
    }
    out.join(",")
}
