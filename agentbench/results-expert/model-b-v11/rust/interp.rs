use std::collections::HashMap;

#[derive(Clone)]
enum Tok {
    Num(i64),
    Name(String),
    Op(String),
}

enum Expr {
    Num(i64),
    Var(String),
    Neg(Box<Expr>),
    Bin(u8, Box<Expr>, Box<Expr>),
}

enum Stmt {
    Assign(String, Expr),
    Print(Expr),
    While(Expr, Vec<Stmt>),
    If(Expr, Vec<Stmt>, Vec<Stmt>),
}

fn lex(src: &str) -> Vec<Tok> {
    let b = src.as_bytes();
    let mut i = 0usize;
    let mut out = Vec::new();
    while i < b.len() {
        let c = b[i];
        if c.is_ascii_whitespace() {
            i += 1;
        } else if c.is_ascii_lowercase() {
            let s = i;
            while i < b.len() && b[i].is_ascii_lowercase() {
                i += 1;
            }
            out.push(Tok::Name(src[s..i].to_string()));
        } else if c.is_ascii_digit() {
            let mut v: i64 = 0;
            while i < b.len() && b[i].is_ascii_digit() {
                v = v.wrapping_mul(10).wrapping_add((b[i] - b'0') as i64);
                i += 1;
            }
            out.push(Tok::Num(v));
        } else {
            let two = src.get(i..i + 2).unwrap_or("");
            if two == "<=" || two == ">=" || two == "==" || two == "!=" {
                out.push(Tok::Op(two.to_string()));
                i += 2;
            } else {
                out.push(Tok::Op((c as char).to_string()));
                i += 1;
            }
        }
    }
    out
}

struct P {
    t: Vec<Tok>,
    p: usize,
}

impl P {
    fn peek_op(&self, s: &str) -> bool {
        match self.t.get(self.p) {
            Some(Tok::Op(o)) => o == s,
            _ => false,
        }
    }

    fn peek_name(&self, s: &str) -> bool {
        match self.t.get(self.p) {
            Some(Tok::Name(o)) => o == s,
            _ => false,
        }
    }

    fn expect_op(&mut self, s: &str) {
        if self.peek_op(s) {
            self.p += 1;
        }
    }

    fn expr(&mut self) -> Expr {
        let l = self.sum();
        let cmp = match self.t.get(self.p) {
            Some(Tok::Op(o)) => match o.as_str() {
                "<" => Some(b'<'),
                ">" => Some(b'>'),
                "<=" => Some(b'l'),
                ">=" => Some(b'g'),
                "==" => Some(b'e'),
                "!=" => Some(b'n'),
                _ => None,
            },
            _ => None,
        };
        match cmp {
            Some(code) => {
                self.p += 1;
                let r = self.sum();
                Expr::Bin(code, Box::new(l), Box::new(r))
            }
            None => l,
        }
    }

    fn sum(&mut self) -> Expr {
        let mut l = self.term();
        loop {
            let op = match self.t.get(self.p) {
                Some(Tok::Op(o)) if o == "+" => b'+',
                Some(Tok::Op(o)) if o == "-" => b'-',
                _ => break,
            };
            self.p += 1;
            let r = self.term();
            l = Expr::Bin(op, Box::new(l), Box::new(r));
        }
        l
    }

    fn term(&mut self) -> Expr {
        let mut l = self.unary();
        loop {
            let op = match self.t.get(self.p) {
                Some(Tok::Op(o)) if o == "*" => b'*',
                Some(Tok::Op(o)) if o == "/" => b'/',
                Some(Tok::Op(o)) if o == "%" => b'%',
                _ => break,
            };
            self.p += 1;
            let r = self.unary();
            l = Expr::Bin(op, Box::new(l), Box::new(r));
        }
        l
    }

    fn unary(&mut self) -> Expr {
        if self.peek_op("-") {
            self.p += 1;
            Expr::Neg(Box::new(self.unary()))
        } else {
            self.primary()
        }
    }

    fn primary(&mut self) -> Expr {
        let t = self.t.get(self.p).cloned();
        match t {
            Some(Tok::Num(v)) => {
                self.p += 1;
                Expr::Num(v)
            }
            Some(Tok::Name(n)) => {
                self.p += 1;
                Expr::Var(n)
            }
            Some(Tok::Op(ref o)) if o == "(" => {
                self.p += 1;
                let e = self.expr();
                self.expect_op(")");
                e
            }
            _ => {
                self.p += 1;
                Expr::Num(0)
            }
        }
    }

    fn block(&mut self) -> Vec<Stmt> {
        let mut v = Vec::new();
        while self.p < self.t.len() && !self.peek_op("}") {
            let before = self.p;
            if let Some(s) = self.stmt() {
                v.push(s);
            }
            if self.p == before {
                self.p += 1;
            }
        }
        v
    }

    fn stmt(&mut self) -> Option<Stmt> {
        if self.peek_name("print") {
            self.p += 1;
            let e = self.expr();
            self.expect_op(";");
            return Some(Stmt::Print(e));
        }
        if self.peek_name("while") {
            self.p += 1;
            let c = self.expr();
            self.expect_op("{");
            let body = self.block();
            self.expect_op("}");
            return Some(Stmt::While(c, body));
        }
        if self.peek_name("if") {
            self.p += 1;
            let c = self.expr();
            self.expect_op("{");
            let t = self.block();
            self.expect_op("}");
            let mut f = Vec::new();
            if self.peek_name("else") {
                self.p += 1;
                self.expect_op("{");
                f = self.block();
                self.expect_op("}");
            }
            return Some(Stmt::If(c, t, f));
        }
        let name = match self.t.get(self.p) {
            Some(Tok::Name(n)) => Some(n.clone()),
            _ => None,
        };
        if let Some(n) = name {
            self.p += 1;
            self.expect_op("=");
            let e = self.expr();
            self.expect_op(";");
            return Some(Stmt::Assign(n, e));
        }
        None
    }
}

struct Rt {
    vars: HashMap<String, i64>,
    out: Vec<String>,
    steps: usize,
}

impl Rt {
    fn step(&mut self) -> Result<(), &'static str> {
        self.steps += 1;
        if self.steps > 5000 {
            Err("!steps")
        } else {
            Ok(())
        }
    }

    fn eval(&self, e: &Expr) -> Result<i64, &'static str> {
        match e {
            Expr::Num(v) => Ok(*v),
            Expr::Var(n) => match self.vars.get(n) {
                Some(v) => Ok(*v),
                None => Err("!undef"),
            },
            Expr::Neg(x) => Ok(self.eval(x)?.wrapping_neg()),
            Expr::Bin(op, l, r) => {
                let a = self.eval(l)?;
                let b = self.eval(r)?;
                let v = match *op {
                    b'+' => a.wrapping_add(b),
                    b'-' => a.wrapping_sub(b),
                    b'*' => a.wrapping_mul(b),
                    b'/' => {
                        if b == 0 {
                            return Err("!div0");
                        }
                        a.wrapping_div(b)
                    }
                    b'%' => {
                        if b == 0 {
                            return Err("!div0");
                        }
                        a.wrapping_rem(b)
                    }
                    b'<' => (a < b) as i64,
                    b'>' => (a > b) as i64,
                    b'l' => (a <= b) as i64,
                    b'g' => (a >= b) as i64,
                    b'e' => (a == b) as i64,
                    _ => (a != b) as i64,
                };
                Ok(v)
            }
        }
    }

    fn exec(&mut self, stmts: &[Stmt]) -> Result<(), &'static str> {
        for s in stmts {
            match s {
                Stmt::Assign(n, e) => {
                    self.step()?;
                    let v = self.eval(e)?;
                    self.vars.insert(n.clone(), v);
                }
                Stmt::Print(e) => {
                    self.step()?;
                    let v = self.eval(e)?;
                    self.out.push(v.to_string());
                }
                Stmt::While(c, body) => loop {
                    self.step()?;
                    if self.eval(c)? == 0 {
                        break;
                    }
                    self.exec(body)?;
                },
                Stmt::If(c, t, f) => {
                    self.step()?;
                    if self.eval(c)? != 0 {
                        self.exec(t)?;
                    } else {
                        self.exec(f)?;
                    }
                }
            }
        }
        Ok(())
    }
}

pub fn interp(src: &str) -> String {
    let mut p = P { t: lex(src), p: 0 };
    let prog = p.block();
    let mut rt = Rt {
        vars: HashMap::new(),
        out: Vec::new(),
        steps: 0,
    };
    let res = rt.exec(&prog);
    let mut items = rt.out;
    if let Err(e) = res {
        items.push(e.to_string());
    }
    items.join(",")
}
