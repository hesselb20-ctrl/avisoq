#[derive(Clone, Copy)]
enum Inst {
    Ch(u8),
    Any,
    Split(usize, usize),
    Jmp(usize),
    Match,
}

enum Node {
    Empty,
    Ch(u8),
    Any,
    Cat(Vec<Node>),
    Alt(Vec<Node>),
    Star(Box<Node>),
    Plus(Box<Node>),
    Opt(Box<Node>),
}

struct RP<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> RP<'a> {
    fn alt(&mut self) -> Node {
        let mut alts = vec![self.cat()];
        while self.i < self.b.len() && self.b[self.i] == b'|' {
            self.i += 1;
            alts.push(self.cat());
        }
        if alts.len() == 1 {
            alts.pop().unwrap()
        } else {
            Node::Alt(alts)
        }
    }

    fn cat(&mut self) -> Node {
        let mut items = Vec::new();
        while self.i < self.b.len() && self.b[self.i] != b'|' && self.b[self.i] != b')' {
            let mut a = self.atom();
            while self.i < self.b.len() && (self.b[self.i] == b'*' || self.b[self.i] == b'+' || self.b[self.i] == b'?') {
                a = match self.b[self.i] {
                    b'*' => Node::Star(Box::new(a)),
                    b'+' => Node::Plus(Box::new(a)),
                    _ => Node::Opt(Box::new(a)),
                };
                self.i += 1;
            }
            items.push(a);
        }
        if items.is_empty() {
            Node::Empty
        } else if items.len() == 1 {
            items.pop().unwrap()
        } else {
            Node::Cat(items)
        }
    }

    fn atom(&mut self) -> Node {
        let c = self.b[self.i];
        self.i += 1;
        if c == b'(' {
            let n = self.alt();
            self.i += 1; // ')'
            n
        } else if c == b'.' {
            Node::Any
        } else {
            Node::Ch(c)
        }
    }
}

fn comp(n: &Node, code: &mut Vec<Inst>) {
    match n {
        Node::Empty => {}
        Node::Ch(c) => code.push(Inst::Ch(*c)),
        Node::Any => code.push(Inst::Any),
        Node::Cat(v) => {
            for x in v.iter() {
                comp(x, code);
            }
        }
        Node::Alt(v) => {
            let mut jmps = Vec::new();
            for (k, x) in v.iter().enumerate() {
                if k + 1 < v.len() {
                    let sp = code.len();
                    code.push(Inst::Split(0, 0));
                    comp(x, code);
                    jmps.push(code.len());
                    code.push(Inst::Jmp(0));
                    let next = code.len();
                    code[sp] = Inst::Split(sp + 1, next);
                } else {
                    comp(x, code);
                }
            }
            let end = code.len();
            for j in jmps {
                code[j] = Inst::Jmp(end);
            }
        }
        Node::Star(x) => {
            let l = code.len();
            code.push(Inst::Split(0, 0));
            comp(x, code);
            code.push(Inst::Jmp(l));
            let end = code.len();
            code[l] = Inst::Split(l + 1, end);
        }
        Node::Plus(x) => {
            let l = code.len();
            comp(x, code);
            let sp = code.len();
            code.push(Inst::Split(l, sp + 1));
        }
        Node::Opt(x) => {
            let sp = code.len();
            code.push(Inst::Split(0, 0));
            comp(x, code);
            let end = code.len();
            code[sp] = Inst::Split(sp + 1, end);
        }
    }
}

fn add(code: &Vec<Inst>, pc: usize, list: &mut Vec<usize>, seen: &mut Vec<bool>) {
    if seen[pc] {
        return;
    }
    seen[pc] = true;
    match code[pc] {
        Inst::Jmp(t) => add(code, t, list, seen),
        Inst::Split(a, b) => {
            add(code, a, list, seen);
            add(code, b, list, seen);
        }
        _ => list.push(pc),
    }
}

pub fn regex_match(pattern: &str, text: &str) -> bool {
    let mut p = RP {
        b: pattern.as_bytes(),
        i: 0,
    };
    let node = p.alt();
    let mut code = Vec::new();
    comp(&node, &mut code);
    code.push(Inst::Match);
    let n = code.len();

    let mut cur = Vec::new();
    let mut seen = vec![false; n];
    add(&code, 0, &mut cur, &mut seen);
    for &ch in text.as_bytes() {
        let mut nxt = Vec::new();
        let mut seen = vec![false; n];
        for &pc in cur.iter() {
            match code[pc] {
                Inst::Ch(c) if c == ch => add(&code, pc + 1, &mut nxt, &mut seen),
                Inst::Any => add(&code, pc + 1, &mut nxt, &mut seen),
                _ => {}
            }
        }
        cur = nxt;
        if cur.is_empty() {
            return false;
        }
    }
    cur.iter().any(|&pc| match code[pc] {
        Inst::Match => true,
        _ => false,
    })
}
