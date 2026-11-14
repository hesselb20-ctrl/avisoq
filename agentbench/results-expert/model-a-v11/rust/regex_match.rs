enum N {
    Lit(u8),
    Any,
    Cat(Vec<N>),
    Alt(Vec<N>),
    Star(Box<N>),
    Plus(Box<N>),
    Opt(Box<N>),
}

struct P<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> P<'a> {
    fn alt(&mut self) -> N {
        let mut v = vec![self.cat()];
        while self.i < self.b.len() && self.b[self.i] == b'|' {
            self.i += 1;
            v.push(self.cat());
        }
        N::Alt(v)
    }
    fn cat(&mut self) -> N {
        let mut v = Vec::new();
        while self.i < self.b.len() && self.b[self.i] != b'|' && self.b[self.i] != b')' {
            let c = self.b[self.i];
            self.i += 1;
            let mut a = match c {
                b'.' => N::Any,
                b'(' => {
                    let x = self.alt();
                    if self.i < self.b.len() && self.b[self.i] == b')' {
                        self.i += 1;
                    }
                    x
                }
                _ => N::Lit(c),
            };
            while self.i < self.b.len() && matches!(self.b[self.i], b'*' | b'+' | b'?') {
                a = match self.b[self.i] {
                    b'*' => N::Star(Box::new(a)),
                    b'+' => N::Plus(Box::new(a)),
                    _ => N::Opt(Box::new(a)),
                };
                self.i += 1;
            }
            v.push(a);
        }
        N::Cat(v)
    }
}

fn star(n: &N, mask: u64, t: &[u8]) -> u64 {
    let mut r = mask;
    loop {
        let nr = r | ev(n, r, t);
        if nr == r {
            return r;
        }
        r = nr;
    }
}

fn ev(n: &N, mask: u64, t: &[u8]) -> u64 {
    match n {
        N::Lit(c) => {
            let mut r = 0;
            for i in 0..t.len() {
                if (mask >> i) & 1 == 1 && t[i] == *c {
                    r |= 1 << (i + 1);
                }
            }
            r
        }
        N::Any => {
            let mut r = 0;
            for i in 0..t.len() {
                if (mask >> i) & 1 == 1 {
                    r |= 1 << (i + 1);
                }
            }
            r
        }
        N::Cat(v) => {
            let mut m = mask;
            for x in v {
                m = ev(x, m, t);
                if m == 0 {
                    break;
                }
            }
            m
        }
        N::Alt(v) => {
            let mut r = 0;
            for x in v {
                r |= ev(x, mask, t);
            }
            r
        }
        N::Star(x) => star(x, mask, t),
        N::Plus(x) => {
            let a = ev(x, mask, t);
            star(x, a, t)
        }
        N::Opt(x) => mask | ev(x, mask, t),
    }
}

pub fn regex_match(pattern: &str, text: &str) -> bool {
    let mut p = P { b: pattern.as_bytes(), i: 0 };
    let root = p.alt();
    let t = text.as_bytes();
    if t.len() > 62 {
        return false;
    }
    let r = ev(&root, 1, t);
    (r >> t.len()) & 1 == 1
}
