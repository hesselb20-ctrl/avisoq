use std::collections::HashMap;

#[derive(Debug, Clone)]
enum Expr {
    Num(i64),
    Var(String),
    Neg(Box<Expr>),
    Bin(String, Box<Expr>, Box<Expr>),
}

#[derive(Debug, Clone)]
enum Stmt {
    Assign(String, Expr),
    Print(Expr),
    While(Expr, Vec<Stmt>),
    If(Expr, Vec<Stmt>, Vec<Stmt>),
}

fn tokenize(s: &str) -> Vec<String> {
    let b = s.as_bytes();
    let mut i = 0;
    let mut v = Vec::new();
    while i < b.len() {
        let c = b[i];
        if c == b' ' || c == b'\t' || c == b'\n' || c == b'\r' {
            i += 1;
        } else if c.is_ascii_digit() {
            let st = i;
            while i < b.len() && b[i].is_ascii_digit() {
                i += 1;
            }
            v.push(s[st..i].to_string());
        } else if c.is_ascii_lowercase() {
            let st = i;
            while i < b.len() && b[i].is_ascii_lowercase() {
                i += 1;
            }
            v.push(s[st..i].to_string());
        } else if (c == b'<' || c == b'>' || c == b'=' || c == b'!') && i + 1 < b.len() && b[i + 1] == b'=' {
            v.push(s[i..i + 2].to_string());
            i += 2;
        } else {
            v.push(s[i..i + 1].to_string());
            i += 1;
        }
    }
    v
}

struct Parser {
    toks: Vec<String>,
    pos: usize,
}

impl Parser {
    fn peek(&self) -> String {
        if self.pos < self.toks.len() {
            self.toks[self.pos].clone()
        } else {
            String::new()
        }
    }

    fn parse_expr(&mut self) -> Expr {
        let l = self.parse_sum();
        let p = self.peek();
        if p == "<" || p == "<=" || p == ">" || p == ">=" || p == "==" || p == "!=" {
            self.pos += 1;
            let r = self.parse_sum();
            return Expr::Bin(p, Box::new(l), Box::new(r));
        }
        l
    }

    fn parse_sum(&mut self) -> Expr {
        let mut l = self.parse_term();
        loop {
            let p = self.peek();
            if p == "+" || p == "-" {
                self.pos += 1;
                let r = self.parse_term();
                l = Expr::Bin(p, Box::new(l), Box::new(r));
            } else {
                break;
            }
        }
        l
    }

    fn parse_term(&mut self) -> Expr {
        let mut l = self.parse_unary();
        loop {
            let p = self.peek();
            if p == "*" || p == "/" || p == "%" {
                self.pos += 1;
                let r = self.parse_unary();
                l = Expr::Bin(p, Box::new(l), Box::new(r));
            } else {
                break;
            }
        }
        l
    }

    fn parse_unary(&mut self) -> Expr {
        if self.peek() == "-" {
            self.pos += 1;
            Expr::Neg(Box::new(self.parse_unary()))
        } else {
            self.parse_primary()
        }
    }

    fn parse_primary(&mut self) -> Expr {
        let t = self.peek();
        self.pos += 1;
        if t == "(" {
            let e = self.parse_expr();
            self.pos += 1; // ')'
            e
        } else if t.is_empty() {
            Expr::Num(0)
        } else if t.as_bytes()[0].is_ascii_digit() {
            Expr::Num(t.parse::<i64>().unwrap_or(0))
        } else {
            Expr::Var(t)
        }
    }

    // Parses statements until a "}" or the end; consumes the "}".
    fn parse_block(&mut self) -> Vec<Stmt> {
        let mut v = Vec::new();
        loop {
            let p = self.peek();
            if p == "}" || p.is_empty() {
                self.pos += 1;
                break;
            }
            v.push(self.parse_stmt());
        }
        v
    }

    fn parse_stmt(&mut self) -> Stmt {
        let t = self.peek();
        if t == "print" {
            self.pos += 1;
            let e = self.parse_expr();
            self.pos += 1; // ';'
            Stmt::Print(e)
        } else if t == "while" {
            self.pos += 1;
            let c = self.parse_expr();
            self.pos += 1; // '{'
            let b = self.parse_block();
            Stmt::While(c, b)
        } else if t == "if" {
            self.pos += 1;
            let c = self.parse_expr();
            self.pos += 1; // '{'
            let then_b = self.parse_block();
            let mut else_b = Vec::new();
            if self.peek() == "else" {
                self.pos += 1;
                self.pos += 1; // '{'
                else_b = self.parse_block();
            }
            Stmt::If(c, then_b, else_b)
        } else {
            self.pos += 1;
            let name = t;
            self.pos += 1; // '='
            let e = self.parse_expr();
            self.pos += 1; // ';'
            Stmt::Assign(name, e)
        }
    }
}

type R<T> = Result<T, &'static str>;

struct Machine {
    vars: HashMap<String, i64>,
    out: Vec<String>,
    steps: u32,
}

impl Machine {
    fn step(&mut self) -> R<()> {
        self.steps += 1;
        if self.steps > 5000 {
            Err("!steps")
        } else {
            Ok(())
        }
    }

    fn eval(&mut self, e: &Expr) -> R<i64> {
        match e {
            Expr::Num(n) => Ok(*n),
            Expr::Var(v) => match self.vars.get(v) {
                Some(x) => Ok(*x),
                None => Err("!undef"),
            },
            Expr::Neg(x) => {
                let a = self.eval(x)?;
                Ok(a.wrapping_neg())
            }
            Expr::Bin(op, l, r) => {
                let a = self.eval(l)?;
                let b = self.eval(r)?;
                let v = match op.as_str() {
                    "+" => a.wrapping_add(b),
                    "-" => a.wrapping_sub(b),
                    "*" => a.wrapping_mul(b),
                    "/" => {
                        if b == 0 {
                            return Err("!div0");
                        }
                        a.wrapping_div(b)
                    }
                    "%" => {
                        if b == 0 {
                            return Err("!div0");
                        }
                        a.wrapping_rem(b)
                    }
                    "<" => (a < b) as i64,
                    "<=" => (a <= b) as i64,
                    ">" => (a > b) as i64,
                    ">=" => (a >= b) as i64,
                    "==" => (a == b) as i64,
                    "!=" => (a != b) as i64,
                    _ => 0,
                };
                Ok(v)
            }
        }
    }

    fn exec(&mut self, stmts: &[Stmt]) -> R<()> {
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
                Stmt::If(c, t, f) => {
                    self.step()?;
                    let v = self.eval(c)?;
                    if v != 0 {
                        self.exec(t)?;
                    } else {
                        self.exec(f)?;
                    }
                }
                Stmt::While(c, b) => loop {
                    self.step()?;
                    let v = self.eval(c)?;
                    if v == 0 {
                        break;
                    }
                    self.exec(b)?;
                },
            }
        }
        Ok(())
    }
}

pub fn interp(src: &str) -> String {
    let toks = tokenize(src);
    let mut p = Parser { toks, pos: 0 };
    let mut prog = Vec::new();
    while p.pos < p.toks.len() {
        prog.push(p.parse_stmt());
    }
    let mut m = Machine {
        vars: HashMap::new(),
        out: Vec::new(),
        steps: 0,
    };
    if let Err(e) = m.exec(&prog) {
        m.out.push(e.to_string());
    }
    m.out.join(",")
}
