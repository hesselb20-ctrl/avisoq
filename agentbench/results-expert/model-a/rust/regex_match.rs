enum RNode {
    Empty,
    Ch(u8),
    Any,
    Cat(Vec<RNode>),
    Alt(Vec<RNode>),
    Star(Box<RNode>),
    Plus(Box<RNode>),
    Opt(Box<RNode>),
}

struct RP {
    c: Vec<u8>,
    p: usize,
}

impl RP {
    fn alt(&mut self) -> RNode {
        let mut alts = vec![self.cat()];
        while self.p < self.c.len() && self.c[self.p] == b'|' {
            self.p += 1;
            alts.push(self.cat());
        }
        if alts.len() == 1 {
            alts.pop().unwrap()
        } else {
            RNode::Alt(alts)
        }
    }
    fn cat(&mut self) -> RNode {
        let mut v = Vec::new();
        while self.p < self.c.len() && self.c[self.p] != b'|' && self.c[self.p] != b')' {
            let mut a = if self.c[self.p] == b'(' {
                self.p += 1;
                let r = self.alt();
                self.p += 1; // ')'
                r
            } else if self.c[self.p] == b'.' {
                self.p += 1;
                RNode::Any
            } else {
                let ch = self.c[self.p];
                self.p += 1;
                RNode::Ch(ch)
            };
            while self.p < self.c.len() {
                match self.c[self.p] {
                    b'*' => a = RNode::Star(Box::new(a)),
                    b'+' => a = RNode::Plus(Box::new(a)),
                    b'?' => a = RNode::Opt(Box::new(a)),
                    _ => break,
                }
                self.p += 1;
            }
            v.push(a);
        }
        if v.is_empty() {
            RNode::Empty
        } else {
            RNode::Cat(v)
        }
    }
}

fn step(n: &RNode, set: u64, t: &[u8]) -> u64 {
    match n {
        RNode::Empty => set,
        RNode::Ch(c) => {
            let mut r = 0;
            for i in 0..t.len() {
                if set >> i & 1 == 1 && t[i] == *c {
                    r |= 1 << (i + 1);
                }
            }
            r
        }
        RNode::Any => {
            let mut r = 0;
            for i in 0..t.len() {
                if set >> i & 1 == 1 {
                    r |= 1 << (i + 1);
                }
            }
            r
        }
        RNode::Cat(v) => {
            let mut s = set;
            for x in v {
                s = step(x, s, t);
            }
            s
        }
        RNode::Alt(v) => {
            let mut r = 0;
            for x in v {
                r |= step(x, set, t);
            }
            r
        }
        RNode::Opt(x) => set | step(x, set, t),
        RNode::Star(x) => {
            let mut res = set;
            loop {
                let nw = res | step(x, res, t);
                if nw == res {
                    return res;
                }
                res = nw;
            }
        }
        RNode::Plus(x) => {
            let first = step(x, set, t);
            let mut res = first;
            loop {
                let nw = res | step(x, res, t);
                if nw == res {
                    return res;
                }
                res = nw;
            }
        }
    }
}

pub fn regex_match(pattern: &str, text: &str) -> bool {
    let mut p = RP { c: pattern.bytes().collect(), p: 0 };
    let ast = p.alt();
    let t = text.as_bytes();
    let r = step(&ast, 1, t);
    r >> t.len() & 1 == 1
}
