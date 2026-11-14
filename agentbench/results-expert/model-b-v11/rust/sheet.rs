enum E {
    Num(i64),
    Ref(usize),
    Neg(Box<E>),
    Bin(u8, Box<E>, Box<E>),
}

struct SP<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> SP<'a> {
    fn peek(&self) -> Option<u8> {
        self.b.get(self.i).cloned()
    }

    fn expr(&mut self) -> E {
        let mut l = self.term();
        loop {
            let op = match self.peek() {
                Some(b'+') => b'+',
                Some(b'-') => b'-',
                _ => break,
            };
            self.i += 1;
            let r = self.term();
            l = E::Bin(op, Box::new(l), Box::new(r));
        }
        l
    }

    fn term(&mut self) -> E {
        let mut l = self.unary();
        while self.peek() == Some(b'*') {
            self.i += 1;
            let r = self.unary();
            l = E::Bin(b'*', Box::new(l), Box::new(r));
        }
        l
    }

    fn unary(&mut self) -> E {
        if self.peek() == Some(b'-') {
            self.i += 1;
            E::Neg(Box::new(self.unary()))
        } else {
            self.primary()
        }
    }

    fn primary(&mut self) -> E {
        match self.peek() {
            Some(c) if c.is_ascii_digit() => {
                let mut v: i64 = 0;
                while let Some(d) = self.peek() {
                    if d.is_ascii_digit() {
                        v = v.wrapping_mul(10).wrapping_add((d - b'0') as i64);
                        self.i += 1;
                    } else {
                        break;
                    }
                }
                E::Num(v)
            }
            Some(c) if c.is_ascii_uppercase() => {
                let col = (c - b'A') as usize;
                let d = self.b.get(self.i + 1).cloned().unwrap_or(b'1');
                let row = if d >= b'1' && d <= b'9' {
                    (d - b'1') as usize
                } else {
                    0
                };
                self.i += 2;
                E::Ref(col * 9 + row)
            }
            Some(b'(') => {
                self.i += 1;
                let e = self.expr();
                if self.peek() == Some(b')') {
                    self.i += 1;
                }
                e
            }
            _ => {
                self.i += 1;
                E::Num(0)
            }
        }
    }
}

fn cell(f: &[Option<E>], st: &mut Vec<u8>, val: &mut Vec<Option<i64>>, i: usize) -> Option<i64> {
    if st[i] == 2 {
        return val[i];
    }
    if st[i] == 1 {
        return None;
    }
    let r = match f[i] {
        None => Some(0),
        Some(ref e) => {
            st[i] = 1;
            eval(f, st, val, e)
        }
    };
    st[i] = 2;
    val[i] = r;
    r
}

fn eval(f: &[Option<E>], st: &mut Vec<u8>, val: &mut Vec<Option<i64>>, e: &E) -> Option<i64> {
    match e {
        E::Num(v) => Some(*v),
        E::Ref(j) => cell(f, st, val, *j),
        E::Neg(x) => eval(f, st, val, x).map(|v| v.wrapping_neg()),
        E::Bin(op, l, r) => {
            let a = eval(f, st, val, l)?;
            let b = eval(f, st, val, r)?;
            Some(match *op {
                b'+' => a.wrapping_add(b),
                b'-' => a.wrapping_sub(b),
                _ => a.wrapping_mul(b),
            })
        }
    }
}

pub fn sheet(cells: &str) -> String {
    const N: usize = 26 * 9;
    let mut f: Vec<Option<E>> = Vec::new();
    for _ in 0..N {
        f.push(None);
    }
    let mut assigned = vec![false; N];
    for seg in cells.split(';') {
        let eq = match seg.find('=') {
            Some(p) => p,
            None => continue,
        };
        let name = seg[..eq].as_bytes();
        if name.len() < 2 || !name[0].is_ascii_uppercase() {
            continue;
        }
        let row = if name[1] >= b'1' && name[1] <= b'9' {
            (name[1] - b'1') as usize
        } else {
            continue;
        };
        let idx = (name[0] - b'A') as usize * 9 + row;
        let mut p = SP {
            b: seg[eq + 1..].as_bytes(),
            i: 0,
        };
        f[idx] = Some(p.expr());
        assigned[idx] = true;
    }
    let mut st = vec![0u8; N];
    let mut val: Vec<Option<i64>> = vec![None; N];
    let mut out: Vec<String> = Vec::new();
    for i in 0..N {
        if !assigned[i] {
            continue;
        }
        let v = cell(&f, &mut st, &mut val, i);
        let name = format!("{}{}", (b'A' + (i / 9) as u8) as char, i % 9 + 1);
        match v {
            Some(x) => out.push(format!("{}={}", name, x)),
            None => out.push(format!("{}=#CYCLE", name)),
        }
    }
    out.join(",")
}
