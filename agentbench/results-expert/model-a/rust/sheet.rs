use std::collections::{BTreeMap, HashMap};

enum SE {
    Num(i64),
    Cell(String),
    Neg(Box<SE>),
    Bin(u8, Box<SE>, Box<SE>),
}

struct SP<'a> {
    b: &'a [u8],
    p: usize,
}

impl<'a> SP<'a> {
    fn expr(&mut self) -> SE {
        let mut l = self.term();
        while self.p < self.b.len() && (self.b[self.p] == b'+' || self.b[self.p] == b'-') {
            let op = self.b[self.p];
            self.p += 1;
            let r = self.term();
            l = SE::Bin(op, Box::new(l), Box::new(r));
        }
        l
    }
    fn term(&mut self) -> SE {
        let mut l = self.unary();
        while self.p < self.b.len() && self.b[self.p] == b'*' {
            self.p += 1;
            let r = self.unary();
            l = SE::Bin(b'*', Box::new(l), Box::new(r));
        }
        l
    }
    fn unary(&mut self) -> SE {
        if self.p < self.b.len() && self.b[self.p] == b'-' {
            self.p += 1;
            return SE::Neg(Box::new(self.unary()));
        }
        if self.p < self.b.len() && self.b[self.p] == b'(' {
            self.p += 1;
            let e = self.expr();
            self.p += 1;
            return e;
        }
        if self.p < self.b.len() && self.b[self.p].is_ascii_digit() {
            let mut v: i64 = 0;
            while self.p < self.b.len() && self.b[self.p].is_ascii_digit() {
                v = v.wrapping_mul(10).wrapping_add((self.b[self.p] - b'0') as i64);
                self.p += 1;
            }
            return SE::Num(v);
        }
        if self.p + 1 < self.b.len() {
            let s = String::from_utf8_lossy(&self.b[self.p..self.p + 2]).to_string();
            self.p += 2;
            return SE::Cell(s);
        }
        self.p = self.b.len();
        SE::Num(0)
    }
}

struct Sh {
    defs: HashMap<String, SE>,
    memo: HashMap<String, Option<i64>>,
    stack: Vec<String>,
}

impl Sh {
    fn ev(&mut self, e: &SE) -> Option<i64> {
        match e {
            SE::Num(n) => Some(*n),
            SE::Cell(c) => self.cell(c),
            SE::Neg(x) => self.ev(x).map(|v| v.wrapping_neg()),
            SE::Bin(op, a, b) => {
                let x = self.ev(a);
                let y = self.ev(b);
                let (x, y) = (x?, y?);
                Some(match op {
                    b'+' => x.wrapping_add(y),
                    b'-' => x.wrapping_sub(y),
                    _ => x.wrapping_mul(y),
                })
            }
        }
    }
    fn cell(&mut self, c: &str) -> Option<i64> {
        if let Some(r) = self.memo.get(c) {
            return *r;
        }
        if self.stack.iter().any(|s| s == c) {
            return None;
        }
        if !self.defs.contains_key(c) {
            return Some(0);
        }
        self.stack.push(c.to_string());
        let def = self.defs.remove(c).unwrap();
        let r = self.ev(&def);
        self.defs.insert(c.to_string(), def);
        self.stack.pop();
        self.memo.insert(c.to_string(), r);
        r
    }
}

pub fn sheet(cells: &str) -> String {
    let mut defs: HashMap<String, SE> = HashMap::new();
    let mut names: BTreeMap<String, ()> = BTreeMap::new();
    for seg in cells.split(';') {
        if seg.is_empty() {
            continue;
        }
        let (n, f) = match seg.find('=') {
            Some(i) => (&seg[..i], &seg[i + 1..]),
            None => continue,
        };
        let mut p = SP { b: f.as_bytes(), p: 0 };
        let e = p.expr();
        defs.insert(n.to_string(), e);
        names.insert(n.to_string(), ());
    }
    let mut sh = Sh { defs, memo: HashMap::new(), stack: Vec::new() };
    let mut out = Vec::new();
    for n in names.keys() {
        let v = sh.cell(n);
        match v {
            Some(x) => out.push(format!("{}={}", n, x)),
            None => out.push(format!("{}=#CYCLE", n)),
        }
    }
    out.join(",")
}
