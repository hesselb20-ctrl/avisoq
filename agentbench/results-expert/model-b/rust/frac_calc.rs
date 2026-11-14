#[derive(Clone, Copy)]
struct Q {
    n: i128,
    d: i128,
}

fn gcd(a: i128, b: i128) -> i128 {
    let (mut a, mut b) = (a.abs(), b.abs());
    while b != 0 {
        let t = a % b;
        a = b;
        b = t;
    }
    a
}

// Requires d != 0.
fn mk(n: i128, d: i128) -> Q {
    let (mut n, mut d) = if d < 0 { (-n, -d) } else { (n, d) };
    let g = gcd(n, d);
    if g > 1 {
        n /= g;
        d /= g;
    }
    Q { n, d }
}

struct Fp<'a> {
    b: &'a [u8],
    i: usize,
    bad: bool,
}

impl<'a> Fp<'a> {
    fn peek(&mut self) -> u8 {
        while self.i < self.b.len() && self.b[self.i] == b' ' {
            self.i += 1;
        }
        if self.i < self.b.len() {
            self.b[self.i]
        } else {
            0
        }
    }

    fn sum(&mut self) -> Q {
        let mut l = self.term();
        loop {
            let c = self.peek();
            if c == b'+' || c == b'-' {
                self.i += 1;
                let r = self.term();
                l = if c == b'+' {
                    mk(l.n * r.d + r.n * l.d, l.d * r.d)
                } else {
                    mk(l.n * r.d - r.n * l.d, l.d * r.d)
                };
            } else {
                break;
            }
        }
        l
    }

    fn term(&mut self) -> Q {
        let mut l = self.unary();
        loop {
            let c = self.peek();
            if c == b'*' {
                self.i += 1;
                let r = self.unary();
                l = mk(l.n * r.n, l.d * r.d);
            } else if c == b'/' {
                self.i += 1;
                let r = self.unary();
                if r.n == 0 {
                    self.bad = true;
                    l = Q { n: 0, d: 1 };
                } else {
                    l = mk(l.n * r.d, l.d * r.n);
                }
            } else {
                break;
            }
        }
        l
    }

    fn unary(&mut self) -> Q {
        if self.peek() == b'-' {
            self.i += 1;
            let x = self.unary();
            Q { n: -x.n, d: x.d }
        } else {
            self.prim()
        }
    }

    fn prim(&mut self) -> Q {
        let c = self.peek();
        if c == b'(' {
            self.i += 1;
            let e = self.sum();
            self.peek();
            self.i += 1; // ')'
            e
        } else {
            let mut v: i128 = 0;
            while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
                v = v * 10 + (self.b[self.i] - b'0') as i128;
                self.i += 1;
            }
            Q { n: v, d: 1 }
        }
    }
}

pub fn frac_calc(s: &str) -> String {
    let mut p = Fp {
        b: s.as_bytes(),
        i: 0,
        bad: false,
    };
    let r = p.sum();
    if p.bad {
        return "div0".to_string();
    }
    if r.d == 1 {
        format!("{}", r.n)
    } else {
        format!("{}/{}", r.n, r.d)
    }
}
