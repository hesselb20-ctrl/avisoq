fn gcd(a: i128, b: i128) -> i128 {
    let (mut a, mut b) = (a.abs(), b.abs());
    while b != 0 {
        let t = a % b;
        a = b;
        b = t;
    }
    a
}

#[derive(Clone, Copy)]
struct F(i128, i128);

fn mk(n: i128, d: i128) -> F {
    let g = gcd(n, d);
    let g = if g == 0 { 1 } else { g };
    let (mut n, mut d) = (n / g, d / g);
    if d < 0 {
        n = -n;
        d = -d;
    }
    F(n, d)
}

struct P {
    b: Vec<u8>,
    i: usize,
    bad: bool,
}

impl P {
    fn ws(&mut self) {
        while self.i < self.b.len() && self.b[self.i] == b' ' {
            self.i += 1;
        }
    }
    fn expr(&mut self) -> F {
        let mut l = self.term();
        loop {
            self.ws();
            if self.i >= self.b.len() {
                break;
            }
            let c = self.b[self.i];
            if c != b'+' && c != b'-' {
                break;
            }
            self.i += 1;
            let r = self.term();
            l = if c == b'+' {
                mk(l.0 * r.1 + r.0 * l.1, l.1 * r.1)
            } else {
                mk(l.0 * r.1 - r.0 * l.1, l.1 * r.1)
            };
        }
        l
    }
    fn term(&mut self) -> F {
        let mut l = self.unary();
        loop {
            self.ws();
            if self.i >= self.b.len() {
                break;
            }
            let c = self.b[self.i];
            if c != b'*' && c != b'/' {
                break;
            }
            self.i += 1;
            let r = self.unary();
            if c == b'*' {
                l = mk(l.0 * r.0, l.1 * r.1);
            } else if r.0 == 0 {
                self.bad = true;
                l = F(0, 1);
            } else {
                l = mk(l.0 * r.1, l.1 * r.0);
            }
        }
        l
    }
    fn unary(&mut self) -> F {
        self.ws();
        if self.i >= self.b.len() {
            return F(0, 1);
        }
        let c = self.b[self.i];
        if c == b'-' {
            self.i += 1;
            let x = self.unary();
            return F(-x.0, x.1);
        }
        if c == b'(' {
            self.i += 1;
            let x = self.expr();
            self.ws();
            if self.i < self.b.len() && self.b[self.i] == b')' {
                self.i += 1;
            }
            return x;
        }
        let mut n: i128 = 0;
        while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
            n = n * 10 + (self.b[self.i] - b'0') as i128;
            self.i += 1;
        }
        F(n, 1)
    }
}

pub fn frac_calc(s: &str) -> String {
    let mut p = P { b: s.as_bytes().to_vec(), i: 0, bad: false };
    let r = p.expr();
    if p.bad {
        return "div0".to_string();
    }
    if r.1 == 1 {
        format!("{}", r.0)
    } else {
        format!("{}/{}", r.0, r.1)
    }
}
