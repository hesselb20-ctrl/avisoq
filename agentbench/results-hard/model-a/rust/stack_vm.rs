pub fn stack_vm(program: &str) -> String {
    let ins: Vec<(&str, Option<i64>)> = if program.trim().is_empty() { vec![] } else {
        program.split(';').map(|p| {
            let p = p.trim();
            let mut it = p.splitn(2, ' ');
            let name = it.next().unwrap_or("");
            let arg = it.next().and_then(|a| a.trim().parse::<i64>().ok());
            (name, arg)
        }).collect()
    };
    let n = ins.len() as i64;
    let mut st: Vec<i64> = vec![];
    let mut out: Vec<String> = vec![];
    let mut pc: i64 = 0;
    let mut steps = 0;
    while pc >= 0 && pc < n {
        if steps >= 1000 { out.push("!steps".to_string()); break; }
        steps += 1;
        let (name, arg) = ins[pc as usize];
        let mut next = pc + 1;
        match name {
            "push" => st.push(arg.unwrap_or(0)),
            "add" | "sub" | "mul" => {
                if st.len() < 2 { out.push("!stack".to_string()); break; }
                let b = st.pop().unwrap(); let a = st.pop().unwrap();
                st.push(match name { "add" => a.wrapping_add(b), "sub" => a.wrapping_sub(b), _ => a.wrapping_mul(b) });
            }
            "dup" => {
                if st.is_empty() { out.push("!stack".to_string()); break; }
                let t = *st.last().unwrap(); st.push(t);
            }
            "swap" => {
                if st.len() < 2 { out.push("!stack".to_string()); break; }
                let l = st.len(); st.swap(l - 1, l - 2);
            }
            "pop" => {
                if st.is_empty() { out.push("!stack".to_string()); break; }
                st.pop();
            }
            "out" => {
                if st.is_empty() { out.push("!stack".to_string()); break; }
                out.push(st.pop().unwrap().to_string());
            }
            "jmp" => {
                let k = arg.unwrap_or(0);
                if k < 0 || k > n { out.push("!jump".to_string()); break; }
                next = k;
            }
            "jz" => {
                if st.is_empty() { out.push("!stack".to_string()); break; }
                let v = st.pop().unwrap();
                if v == 0 {
                    let k = arg.unwrap_or(0);
                    if k < 0 || k > n { out.push("!jump".to_string()); break; }
                    next = k;
                }
            }
            "halt" => break,
            _ => {}
        }
        pc = next;
    }
    out.join(",")
}
