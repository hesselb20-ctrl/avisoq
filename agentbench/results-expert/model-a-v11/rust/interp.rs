use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq)]
enum Tok {
    Num(i64),
    Id(String),
    Sym(&'static str),
}

fn tokenize(src: &str) -> Vec<Tok> {
    let b = src.as_bytes();
    let mut i = 0;
    let mut v = Vec::new();
    while i < b.len() {
        let c = b[i];
        if c.is_ascii_whitespace() {
            i += 1;
            continue;
        }
        if c.is_ascii_digit() {
            let mut n: i64 = 0;
            while i < b.len() && b[i].is_ascii_digit() {
                n = n.wrapping_mul(10).wrapping_add((b[i] - b'0') as i64);
                i += 1;
            }
            v.push(Tok::Num(n));
            continue;
        }
        if c.is_ascii_lowercase() {
            let s = i;
            while i < b.len() && b[i].is_ascii_lowercase() {
                i += 1;
            }
            v.push(Tok::Id(src[s..i].to_string()));
            continue;
        }
        let nx = if i + 1 < b.len() { b[i + 1] } else { 0 };
        let (s, l): (&'static str, usize) = match (c, nx) {
            (b'<', b'=') => ("<=", 2),
            (b'>', b'=') => (">=", 2),
            (b'=', b'=') => ("==", 2),
            (b'!', b'=') => ("!=", 2),
            (b'<', _) => ("<", 1),
            (b'>', _) => (">", 1),
            (b'=', _) => ("=", 1),
            (b'+', _) => ("+", 1),
            (b'-', _) => ("-", 1),
            (b'*', _) => ("*", 1),
            (b'/', _) => ("/", 1),
            (b'%', _) => ("%", 1),
            (b'(', _) => ("(", 1),
            (b')', _) => (")", 1),
            (b'{', _) => ("{", 1),
            (b'}', _) => ("}", 1),
            (b';', _) => (";", 1),
            _ => {
                i += 1;
                continue;
            }
        };
        v.push(Tok::Sym(s));
        i += l;
    }
    v
}

enum Expr {
    Num(i64),
    Var(String),
    Neg(Box<Expr>),
    Bin(&'static str, Box<Expr>, Box<Expr>),
}

enum Stmt {
    Assign(String, Expr),
    Print(Expr),
    While(Expr, Vec<Stmt>),
    If(Expr, Vec<Stmt>, Vec<Stmt>),
}

struct Parser {
    t: Vec<Tok>,
    p: usize,
}

impl Parser {
    fn peek(&self) -> Option<&Tok> {
        self.t.get(self.p)
    }
    fn is_sym(&self, s: &str) -> bool {
        matches!(self.peek(), Some(Tok::Sym(x)) if *x == s)
    }
    fn eat_sym(&mut self, s: &str) -> bool {
        if self.is_sym(s) {
            self.p += 1;
            true
        } else {
            false
        }
    }
    fn stmts(&mut self) -> Vec<Stmt> {
        let mut out = Vec::new();
        while self.p < self.t.len() && !self.is_sym("}") {
            match self.stmt() {
                Some(s) => out.push(s),
                None => {
                    self.p += 1;
                }
            }
        }
        out
    }
    fn block(&mut self) -> Vec<Stmt> {
        self.eat_sym("{");
        let b = self.stmts();
        self.eat_sym("}");
        b
    }
    fn stmt(&mut self) -> Option<Stmt> {
        let tok = self.peek()?.clone();
        if let Tok::Id(name) = tok {
            self.p += 1;
            match name.as_str() {
                "print" => {
                    let e = self.expr();
                    self.eat_sym(";");
                    Some(Stmt::Print(e))
                }
                "while" => {
                    let c = self.expr();
                    let b = self.block();
                    Some(Stmt::While(c, b))
                }
                "if" => {
                    let c = self.expr();
                    let b = self.block();
                    let mut e = Vec::new();
                    if matches!(self.peek(), Some(Tok::Id(x)) if x == "else") {
                        self.p += 1;
                        e = self.block();
                    }
                    Some(Stmt::If(c, b, e))
                }
                _ => {
                    self.eat_sym("=");
                    let e = self.expr();
                    self.eat_sym(";");
                    Some(Stmt::Assign(name, e))
                }
            }
        } else {
            None
        }
    }
    fn expr(&mut self) -> Expr {
        let l = self.sum();
        for op in ["<=", ">=", "==", "!=", "<", ">"] {
            if self.is_sym(op) {
                self.p += 1;
                let r = self.sum();
                return Expr::Bin(op, Box::new(l), Box::new(r));
            }
        }
        l
    }
    fn sum(&mut self) -> Expr {
        let mut l = self.term();
        loop {
            let op = if self.is_sym("+") {
                "+"
            } else if self.is_sym("-") {
                "-"
            } else {
                break;
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
            let op = if self.is_sym("*") {
                "*"
            } else if self.is_sym("/") {
                "/"
            } else if self.is_sym("%") {
                "%"
            } else {
                break;
            };
            self.p += 1;
            let r = self.unary();
            l = Expr::Bin(op, Box::new(l), Box::new(r));
        }
        l
    }
    fn unary(&mut self) -> Expr {
        if self.eat_sym("-") {
            let e = self.unary();
            return Expr::Neg(Box::new(e));
        }
        match self.peek().cloned() {
            Some(Tok::Num(n)) => {
                self.p += 1;
                Expr::Num(n)
            }
            Some(Tok::Id(s)) => {
                self.p += 1;
                Expr::Var(s)
            }
            Some(Tok::Sym("(")) => {
                self.p += 1;
                let e = self.expr();
                self.eat_sym(")");
                e
            }
            _ => Expr::Num(0),
        }
    }
}

struct Run {
    vars: HashMap<String, i64>,
    out: Vec<String>,
    steps: u64,
}

type R<T> = Result<T, &'static str>;

impl Run {
    fn step(&mut self) -> R<()> {
        self.steps += 1;
        if self.steps > 5000 {
            Err("!steps")
        } else {
            Ok(())
        }
    }
    fn eval(&self, e: &Expr) -> R<i64> {
        match e {
            Expr::Num(n) => Ok(*n),
            Expr::Var(s) => self.vars.get(s).copied().ok_or("!undef"),
            Expr::Neg(x) => Ok(self.eval(x)?.wrapping_neg()),
            Expr::Bin(op, a, b) => {
                let x = self.eval(a)?;
                let y = self.eval(b)?;
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
    fn exec(&mut self, ss: &[Stmt]) -> R<()> {
        for s in ss {
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
                Stmt::While(c, b) => loop {
                    self.step()?;
                    if self.eval(c)? == 0 {
                        break;
                    }
                    self.exec(b)?;
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
    let mut p = Parser { t: tokenize(src), p: 0 };
    let prog = p.stmts();
    let mut r = Run { vars: HashMap::new(), out: Vec::new(), steps: 0 };
    if let Err(e) = r.exec(&prog) {
        r.out.push(e.to_string());
    }
    r.out.join(",")
}
