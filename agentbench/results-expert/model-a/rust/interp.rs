use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
enum Tok {
    Num(i64),
    Name(String),
    Op(&'static str),
}

enum Ex {
    Num(i64),
    Var(String),
    Neg(Box<Ex>),
    Bin(&'static str, Box<Ex>, Box<Ex>),
}

enum St {
    Assign(String, Ex),
    Print(Ex),
    While(Ex, Vec<St>),
    If(Ex, Vec<St>, Vec<St>),
}

fn lex(src: &str) -> Vec<Tok> {
    let b: Vec<char> = src.chars().collect();
    let mut i = 0;
    let mut out = Vec::new();
    while i < b.len() {
        let c = b[i];
        if c.is_whitespace() {
            i += 1;
        } else if c.is_ascii_digit() {
            let mut v: i64 = 0;
            while i < b.len() && b[i].is_ascii_digit() {
                v = v.wrapping_mul(10).wrapping_add(b[i] as i64 - 48);
                i += 1;
            }
            out.push(Tok::Num(v));
        } else if c.is_ascii_lowercase() {
            let mut s = String::new();
            while i < b.len() && b[i].is_ascii_lowercase() {
                s.push(b[i]);
                i += 1;
            }
            out.push(Tok::Name(s));
        } else {
            let nx = if i + 1 < b.len() { b[i + 1] } else { ' ' };
            let (op, l): (&'static str, usize) = match (c, nx) {
                ('<', '=') => ("<=", 2),
                ('>', '=') => (">=", 2),
                ('=', '=') => ("==", 2),
                ('!', '=') => ("!=", 2),
                ('<', _) => ("<", 1),
                ('>', _) => (">", 1),
                ('=', _) => ("=", 1),
                ('+', _) => ("+", 1),
                ('-', _) => ("-", 1),
                ('*', _) => ("*", 1),
                ('/', _) => ("/", 1),
                ('%', _) => ("%", 1),
                ('(', _) => ("(", 1),
                (')', _) => (")", 1),
                ('{', _) => ("{", 1),
                ('}', _) => ("}", 1),
                (';', _) => (";", 1),
                _ => ("?", 1),
            };
            out.push(Tok::Op(op));
            i += l;
        }
    }
    out
}

struct P {
    t: Vec<Tok>,
    p: usize,
}

impl P {
    fn peek_op(&self, o: &str) -> bool {
        matches!(self.t.get(self.p), Some(Tok::Op(x)) if *x == o)
    }
    fn peek_name(&self, o: &str) -> bool {
        matches!(self.t.get(self.p), Some(Tok::Name(x)) if x == o)
    }
    fn expect_op(&mut self, o: &str) {
        if self.peek_op(o) {
            self.p += 1;
        }
    }
    fn block(&mut self) -> Vec<St> {
        self.expect_op("{");
        let v = self.stmts();
        self.expect_op("}");
        v
    }
    fn stmts(&mut self) -> Vec<St> {
        let mut v = Vec::new();
        while self.p < self.t.len() && !self.peek_op("}") {
            v.push(self.stmt());
        }
        v
    }
    fn stmt(&mut self) -> St {
        if self.peek_name("print") {
            self.p += 1;
            let e = self.expr();
            self.expect_op(";");
            St::Print(e)
        } else if self.peek_name("while") {
            self.p += 1;
            let e = self.expr();
            let b = self.block();
            St::While(e, b)
        } else if self.peek_name("if") {
            self.p += 1;
            let e = self.expr();
            let a = self.block();
            let mut b = Vec::new();
            if self.peek_name("else") {
                self.p += 1;
                b = self.block();
            }
            St::If(e, a, b)
        } else {
            let name = match self.t.get(self.p) {
                Some(Tok::Name(n)) => n.clone(),
                _ => {
                    self.p += 1;
                    String::new()
                }
            };
            if !name.is_empty() {
                self.p += 1;
            }
            self.expect_op("=");
            let e = self.expr();
            self.expect_op(";");
            St::Assign(name, e)
        }
    }
    fn expr(&mut self) -> Ex {
        let l = self.sum();
        for op in ["<=", ">=", "==", "!=", "<", ">"] {
            if self.peek_op(op) {
                self.p += 1;
                let r = self.sum();
                return Ex::Bin(op, Box::new(l), Box::new(r));
            }
        }
        l
    }
    fn sum(&mut self) -> Ex {
        let mut l = self.term();
        loop {
            let op = if self.peek_op("+") {
                "+"
            } else if self.peek_op("-") {
                "-"
            } else {
                break;
            };
            self.p += 1;
            let r = self.term();
            l = Ex::Bin(op, Box::new(l), Box::new(r));
        }
        l
    }
    fn term(&mut self) -> Ex {
        let mut l = self.unary();
        loop {
            let op = if self.peek_op("*") {
                "*"
            } else if self.peek_op("/") {
                "/"
            } else if self.peek_op("%") {
                "%"
            } else {
                break;
            };
            self.p += 1;
            let r = self.unary();
            l = Ex::Bin(op, Box::new(l), Box::new(r));
        }
        l
    }
    fn unary(&mut self) -> Ex {
        if self.peek_op("-") {
            self.p += 1;
            let e = self.unary();
            return Ex::Neg(Box::new(e));
        }
        match self.t.get(self.p).cloned() {
            Some(Tok::Num(n)) => {
                self.p += 1;
                Ex::Num(n)
            }
            Some(Tok::Name(n)) => {
                self.p += 1;
                Ex::Var(n)
            }
            _ => {
                self.expect_op("(");
                let e = self.expr();
                self.expect_op(")");
                e
            }
        }
    }
}

struct Run {
    vars: HashMap<String, i64>,
    out: Vec<String>,
    steps: u32,
}

fn eval(e: &Ex, r: &Run) -> Result<i64, &'static str> {
    match e {
        Ex::Num(n) => Ok(*n),
        Ex::Var(v) => r.vars.get(v).copied().ok_or("!undef"),
        Ex::Neg(x) => Ok(eval(x, r)?.wrapping_neg()),
        Ex::Bin(op, a, b) => {
            let x = eval(a, r)?;
            let y = eval(b, r)?;
            Ok(match *op {
                "+" => x.wrapping_add(y),
                "-" => x.wrapping_sub(y),
                "*" => x.wrapping_mul(y),
                "/" => {
                    if y == 0 {
                        return Err("!div0");
                    }
                    x.wrapping_div(y)
                }
                "%" => {
                    if y == 0 {
                        return Err("!div0");
                    }
                    x.wrapping_rem(y)
                }
                "<" => (x < y) as i64,
                "<=" => (x <= y) as i64,
                ">" => (x > y) as i64,
                ">=" => (x >= y) as i64,
                "==" => (x == y) as i64,
                _ => (x != y) as i64,
            })
        }
    }
}

fn step(r: &mut Run) -> Result<(), &'static str> {
    r.steps += 1;
    if r.steps > 5000 {
        Err("!steps")
    } else {
        Ok(())
    }
}

fn exec(b: &[St], r: &mut Run) -> Result<(), &'static str> {
    for s in b {
        match s {
            St::Assign(n, e) => {
                step(r)?;
                let v = eval(e, r)?;
                r.vars.insert(n.clone(), v);
            }
            St::Print(e) => {
                step(r)?;
                let v = eval(e, r)?;
                r.out.push(v.to_string());
            }
            St::If(c, a, bb) => {
                step(r)?;
                let v = eval(c, r)?;
                if v != 0 {
                    exec(a, r)?;
                } else {
                    exec(bb, r)?;
                }
            }
            St::While(c, body) => loop {
                step(r)?;
                let v = eval(c, r)?;
                if v == 0 {
                    break;
                }
                exec(body, r)?;
            },
        }
    }
    Ok(())
}

pub fn interp(src: &str) -> String {
    let mut p = P { t: lex(src), p: 0 };
    let prog = p.stmts();
    let mut r = Run { vars: HashMap::new(), out: Vec::new(), steps: 0 };
    if let Err(e) = exec(&prog, &mut r) {
        r.out.push(e.to_string());
    }
    r.out.join(",")
}
