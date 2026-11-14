enum R {
    Empty,
    Lit(u8),
    Dot,
    Cat(Box<R>, Box<R>),
    Alt(Box<R>, Box<R>),
    Star(Box<R>),
    Plus(Box<R>),
    Opt(Box<R>),
}

struct RP<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> RP<'a> {
    fn peek(&self) -> Option<u8> {
        self.b.get(self.i).cloned()
    }

    fn alt(&mut self) -> R {
        let mut l = self.cat();
        while self.peek() == Some(b'|') {
            self.i += 1;
            let r = self.cat();
            l = R::Alt(Box::new(l), Box::new(r));
        }
        l
    }

    fn cat(&mut self) -> R {
        let mut acc: Option<R> = None;
        while let Some(c) = self.peek() {
            if c == b'|' || c == b')' {
                break;
            }
            let mut a = self.atom();
            loop {
                match self.peek() {
                    Some(b'*') => {
                        self.i += 1;
                        a = R::Star(Box::new(a));
                    }
                    Some(b'+') => {
                        self.i += 1;
                        a = R::Plus(Box::new(a));
                    }
                    Some(b'?') => {
                        self.i += 1;
                        a = R::Opt(Box::new(a));
                    }
                    _ => break,
                }
            }
            acc = Some(match acc {
                None => a,
                Some(x) => R::Cat(Box::new(x), Box::new(a)),
            });
        }
        acc.unwrap_or(R::Empty)
    }

    fn atom(&mut self) -> R {
        let c = match self.peek() {
            Some(c) => c,
            None => return R::Empty,
        };
        self.i += 1;
        match c {
            b'(' => {
                let r = self.alt();
                if self.peek() == Some(b')') {
                    self.i += 1;
                }
                r
            }
            b'.' => R::Dot,
            _ => R::Lit(c),
        }
    }
}

enum St {
    Ch(u8, usize),
    Any(usize),
    Split(usize, usize),
    Match,
}

// Builds the NFA backwards: returns the entry state for `r` followed by state `next`.
fn build(r: &R, next: usize, st: &mut Vec<St>) -> usize {
    match r {
        R::Empty => next,
        R::Lit(c) => {
            st.push(St::Ch(*c, next));
            st.len() - 1
        }
        R::Dot => {
            st.push(St::Any(next));
            st.len() - 1
        }
        R::Cat(a, b) => {
            let eb = build(b, next, st);
            build(a, eb, st)
        }
        R::Alt(a, b) => {
            let ea = build(a, next, st);
            let eb = build(b, next, st);
            st.push(St::Split(ea, eb));
            st.len() - 1
        }
        R::Opt(x) => {
            let ex = build(x, next, st);
            st.push(St::Split(ex, next));
            st.len() - 1
        }
        R::Star(x) => {
            st.push(St::Split(0, next));
            let s = st.len() - 1;
            let ex = build(x, s, st);
            st[s] = St::Split(ex, next);
            s
        }
        R::Plus(x) => {
            st.push(St::Split(0, next));
            let s = st.len() - 1;
            let ex = build(x, s, st);
            st[s] = St::Split(ex, next);
            ex
        }
    }
}

fn closure(st: &[St], seeds: &[usize], mark: &mut Vec<bool>, out: &mut Vec<usize>) {
    let mut stack: Vec<usize> = seeds.to_vec();
    while let Some(s) = stack.pop() {
        if mark[s] {
            continue;
        }
        mark[s] = true;
        match st[s] {
            St::Split(a, b) => {
                stack.push(a);
                stack.push(b);
            }
            _ => out.push(s),
        }
    }
}

pub fn regex_match(pattern: &str, text: &str) -> bool {
    let mut p = RP {
        b: pattern.as_bytes(),
        i: 0,
    };
    let r = p.alt();
    let mut st: Vec<St> = Vec::new();
    st.push(St::Match);
    let start = build(&r, 0, &mut st);
    let n = st.len();
    let mut cur: Vec<usize> = Vec::new();
    let mut mark = vec![false; n];
    closure(&st, &[start], &mut mark, &mut cur);
    for &c in text.as_bytes() {
        let mut seeds: Vec<usize> = Vec::new();
        for &s in &cur {
            match st[s] {
                St::Ch(x, nx) => {
                    if x == c {
                        seeds.push(nx);
                    }
                }
                St::Any(nx) => seeds.push(nx),
                _ => {}
            }
        }
        let mut mark2 = vec![false; n];
        let mut nxt: Vec<usize> = Vec::new();
        closure(&st, &seeds, &mut mark2, &mut nxt);
        cur = nxt;
        if cur.is_empty() {
            return false;
        }
    }
    cur.iter().any(|&s| match st[s] {
        St::Match => true,
        _ => false,
    })
}
