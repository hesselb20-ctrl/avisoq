type F = (i128, i128);

fn gcd(a: i128, b: i128) -> i128 {
    if b == 0 {
        a
    } else {
        gcd(b, a % b)
    }
}

fn norm(n: i128, d: i128) -> F {
    let (mut n, mut d) = (n, d);
    if d < 0 {
        n = -n;
        d = -d;
    }
    let g = gcd(n.abs(), d);
    if g == 0 {
        (0, 1)
    } else {
        (n / g, d / g)
    }
}

struct FP {
    b: Vec<u8>,
    i: usize,
}

impl FP {
    fn peek(&self) -> Option<u8> {
        self.b.get(self.i).cloned()
    }

    fn expr(&mut self) -> Result<F, ()> {
        let mut l = self.term()?;
        loop {
            match self.peek() {
                Some(b'+') => {
                    self.i += 1;
                    let r = self.term()?;
                    l = norm(l.0 * r.1 + r.0 * l.1, l.1 * r.1);
                }
                Some(b'-') => {
                    self.i += 1;
                    let r = self.term()?;
                    l = norm(l.0 * r.1 - r.0 * l.1, l.1 * r.1);
                }
                _ => return Ok(l),
            }
        }
    }

    fn term(&mut self) -> Result<F, ()> {
        let mut l = self.unary()?;
        loop {
            match self.peek() {
                Some(b'*') => {
                    self.i += 1;
                    let r = self.unary()?;
                    l = norm(l.0 * r.0, l.1 * r.1);
                }
                Some(b'/') => {
                    self.i += 1;
                    let r = self.unary()?;
                    if r.0 == 0 {
                        return Err(());
                    }
                    l = norm(l.0 * r.1, l.1 * r.0);
                }
                _ => return Ok(l),
            }
        }
    }

    fn unary(&mut self) -> Result<F, ()> {
        if self.peek() == Some(b'-') {
            self.i += 1;
            let x = self.unary()?;
            Ok((-x.0, x.1))
        } else {
            self.primary()
        }
    }

    fn primary(&mut self) -> Result<F, ()> {
        if self.peek() == Some(b'(') {
            self.i += 1;
            let e = self.expr()?;
            if self.peek() == Some(b')') {
                self.i += 1;
            }
            Ok(e)
        } else {
            let mut v: i128 = 0;
            while let Some(d) = self.peek() {
                if d.is_ascii_digit() {
                    v = v * 10 + (d - b'0') as i128;
                    self.i += 1;
                } else {
                    break;
                }
            }
            Ok((v, 1))
        }
    }
}

pub fn frac_calc(s: &str) -> String {
    let b: Vec<u8> = s.bytes().filter(|c| *c != b' ').collect();
    let mut p = FP { b: b, i: 0 };
    match p.expr() {
        Err(_) => "div0".to_string(),
        Ok((n, d)) => {
            if d == 1 {
                n.to_string()
            } else {
                format!("{}/{}", n, d)
            }
        }
    }
}
