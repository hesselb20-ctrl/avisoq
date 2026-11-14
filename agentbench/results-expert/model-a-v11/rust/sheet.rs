use std::collections::HashMap;

struct S {
    f: HashMap<String, String>,
    st: HashMap<String, u8>,
    val: HashMap<String, Option<i64>>,
}

fn comb(a: Option<i64>, b: Option<i64>, f: impl Fn(i64, i64) -> i64) -> Option<i64> {
    match (a, b) {
        (Some(x), Some(y)) => Some(f(x, y)),
        _ => None,
    }
}

fn expr(b: &[u8], p: &mut usize, s: &mut S) -> Option<i64> {
    let mut l = term(b, p, s);
    while *p < b.len() && (b[*p] == b'+' || b[*p] == b'-') {
        let op = b[*p];
        *p += 1;
        let r = term(b, p, s);
        l = if op == b'+' {
            comb(l, r, |x, y| x.wrapping_add(y))
        } else {
            comb(l, r, |x, y| x.wrapping_sub(y))
        };
    }
    l
}

fn term(b: &[u8], p: &mut usize, s: &mut S) -> Option<i64> {
    let mut l = unary(b, p, s);
    while *p < b.len() && b[*p] == b'*' {
        *p += 1;
        let r = unary(b, p, s);
        l = comb(l, r, |x, y| x.wrapping_mul(y));
    }
    l
}

fn unary(b: &[u8], p: &mut usize, s: &mut S) -> Option<i64> {
    if *p >= b.len() {
        return Some(0);
    }
    let c = b[*p];
    if c == b'-' {
        *p += 1;
        return unary(b, p, s).map(|x| x.wrapping_neg());
    }
    if c == b'(' {
        *p += 1;
        let r = expr(b, p, s);
        if *p < b.len() && b[*p] == b')' {
            *p += 1;
        }
        return r;
    }
    if c.is_ascii_digit() {
        let mut n: i64 = 0;
        while *p < b.len() && b[*p].is_ascii_digit() {
            n = n.wrapping_mul(10).wrapping_add((b[*p] - b'0') as i64);
            *p += 1;
        }
        return Some(n);
    }
    let name = String::from_utf8_lossy(&b[*p..(*p + 2).min(b.len())]).to_string();
    *p += 2;
    s.cell(&name)
}

impl S {
    fn cell(&mut self, name: &str) -> Option<i64> {
        if !self.f.contains_key(name) {
            return Some(0);
        }
        match self.st.get(name) {
            Some(1) => return None,
            Some(2) => return self.val[name],
            _ => {}
        }
        self.st.insert(name.to_string(), 1);
        let formula = self.f[name].clone();
        let mut p = 0;
        let r = expr(formula.as_bytes(), &mut p, self);
        self.st.insert(name.to_string(), 2);
        self.val.insert(name.to_string(), r);
        r
    }
}

pub fn sheet(cells: &str) -> String {
    let mut s = S { f: HashMap::new(), st: HashMap::new(), val: HashMap::new() };
    for seg in cells.split(';') {
        if seg.is_empty() {
            continue;
        }
        if let Some(eq) = seg.find('=') {
            s.f.insert(seg[..eq].to_string(), seg[eq + 1..].to_string());
        }
    }
    let mut names: Vec<String> = s.f.keys().cloned().collect();
    names.sort();
    let mut out = Vec::new();
    for n in names {
        let v = s.cell(&n);
        match v {
            Some(x) => out.push(format!("{}={}", n, x)),
            None => out.push(format!("{}=#CYCLE", n)),
        }
    }
    out.join(",")
}
