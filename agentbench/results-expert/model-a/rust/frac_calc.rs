struct FC {
    b: Vec<u8>,
    p: usize,
    bad: bool,
}

fn fgcd(a: i128, b: i128) -> i128 {
    if b == 0 {
        a.abs()
    } else {
        fgcd(b, a % b)
    }
}

fn fnorm(n: i128, d: i128) -> (i128, i128) {
    let g = fgcd(n, d);
    let (mut n, mut d) = if g == 0 { (n, d) } else { (n / g, d / g) };
    if d < 0 {
        n = -n;
        d = -d;
    }
    (n, d)
}

impl FC {
    fn ws(&mut self) {
        while self.p < self.b.len() && self.b[self.p] == b' ' {
            self.p += 1;
        }
    }
    fn peek(&mut self) -> u8 {
        self.ws();
        if self.p < self.b.len() {
            self.b[self.p]
        } else {
            0
        }
    }
    fn expr(&mut self) -> (i128, i128) {
        let mut l = self.term();
        loop {
            let c = self.peek();
            if c != b'+' && c != b'-' {
                break;
            }
            self.p += 1;
            let r = self.term();
            l = if c == b'+' {
                fnorm(l.0 * r.1 + r.0 * l.1, l.1 * r.1)
            } else {
                fnorm(l.0 * r.1 - r.0 * l.1, l.1 * r.1)
            };
        }
        l
    }
    fn term(&mut self) -> (i128, i128) {
        let mut l = self.unary();
        loop {
            let c = self.peek();
            if c != b'*' && c != b'/' {
                break;
            }
            self.p += 1;
            let r = self.unary();
            l = if c == b'*' {
                fnorm(l.0 * r.0, l.1 * r.1)
            } else if r.0 == 0 {
                self.bad = true;
                (0, 1)
            } else {
                fnorm(l.0 * r.1, l.1 * r.0)
            };
        }
        l
    }
    fn unary(&mut self) -> (i128, i128) {
        let c = self.peek();
        if c == b'-' {
            self.p += 1;
            let v = self.unary();
            return (-v.0, v.1);
        }
        if c == b'(' {
            self.p += 1;
            let v = self.expr();
            self.peek();
            self.p += 1;
            return v;
        }
        let mut v: i128 = 0;
        while self.p < self.b.len() && self.b[self.p].is_ascii_digit() {
            v = v * 10 + (self.b[self.p] - b'0') as i128;
            self.p += 1;
        }
        (v, 1)
    }
}

pub fn frac_calc(s: &str) -> String {
    let mut f = FC { b: s.bytes().collect(), p: 0, bad: false };
    let (n, d) = f.expr();
    if f.bad {
        return "div0".to_string();
    }
    if n == 0 {
        "0".to_string()
    } else if d == 1 {
        n.to_string()
    } else {
        format!("{}/{}", n, d)
    }
}
