#[derive(Clone)]
enum E {
    Num(i64),
    Cell(usize),
    Neg(Box<E>),
    Bin(u8, Box<E>, Box<E>),
}

// Cell index: letter * 10 + digit (digit 0..9), so index order equals name order.
fn cell_index(letter: u8, digit: u8) -> usize {
    ((letter - b'A') as usize) * 10 + ((digit - b'0') as usize)
}

struct FP<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> FP<'a> {
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

    fn sum(&mut self) -> E {
        let mut l = self.term();
        loop {
            let c = self.peek();
            if c == b'+' || c == b'-' {
                self.i += 1;
                let r = self.term();
                l = E::Bin(c, Box::new(l), Box::new(r));
            } else {
                break;
            }
        }
        l
    }

    fn term(&mut self) -> E {
        let mut l = self.unary();
        loop {
            let c = self.peek();
            if c == b'*' {
                self.i += 1;
                let r = self.unary();
                l = E::Bin(c, Box::new(l), Box::new(r));
            } else {
                break;
            }
        }
        l
    }

    fn unary(&mut self) -> E {
        if self.peek() == b'-' {
            self.i += 1;
            E::Neg(Box::new(self.unary()))
        } else {
            self.prim()
        }
    }

    fn prim(&mut self) -> E {
        let c = self.peek();
        if c == b'(' {
            self.i += 1;
            let e = self.sum();
            self.peek();
            self.i += 1; // ')'
            e
        } else if c.is_ascii_uppercase() {
            let d = self.b[self.i + 1];
            self.i += 2;
            E::Cell(cell_index(c, d))
        } else {
            let mut v: i64 = 0;
            while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
                v = v.wrapping_mul(10).wrapping_add((self.b[self.i] - b'0') as i64);
                self.i += 1;
            }
            E::Num(v)
        }
    }
}

#[derive(Clone, Copy, PartialEq)]
enum St {
    Todo,
    Busy,
    Done,
}

struct Ev {
    exprs: Vec<Option<E>>,
    state: Vec<St>,
    val: Vec<Result<i64, ()>>,
}

fn eval_cell(c: usize, ev: &mut Ev) -> Result<i64, ()> {
    let e = match ev.exprs[c].clone() {
        Some(e) => e,
        None => return Ok(0),
    };
    match ev.state[c] {
        St::Done => return ev.val[c],
        St::Busy => return Err(()),
        St::Todo => {}
    }
    ev.state[c] = St::Busy;
    let r = eval_expr(&e, ev);
    ev.state[c] = St::Done;
    ev.val[c] = r;
    r
}

fn eval_expr(e: &E, ev: &mut Ev) -> Result<i64, ()> {
    match e {
        E::Num(n) => Ok(*n),
        E::Cell(c) => eval_cell(*c, ev),
        E::Neg(x) => {
            let a = eval_expr(x, ev)?;
            Ok(a.wrapping_neg())
        }
        E::Bin(op, l, r) => {
            let a = eval_expr(l, ev)?;
            let b = eval_expr(r, ev)?;
            Ok(match *op {
                b'+' => a.wrapping_add(b),
                b'-' => a.wrapping_sub(b),
                _ => a.wrapping_mul(b),
            })
        }
    }
}

pub fn sheet(cells: &str) -> String {
    let mut exprs: Vec<Option<E>> = vec![None; 260];
    let mut assigned = vec![false; 260];
    for ent in cells.split(';') {
        let b = ent.as_bytes();
        if b.len() < 3 {
            continue;
        }
        let eq = match ent.find('=') {
            Some(p) => p,
            None => continue,
        };
        if eq != 2 {
            continue;
        }
        let idx = cell_index(b[0], b[1]);
        let mut fp = FP {
            b: &b[eq + 1..],
            i: 0,
        };
        let e = fp.sum();
        exprs[idx] = Some(e);
        assigned[idx] = true;
    }
    let mut ev = Ev {
        exprs,
        state: vec![St::Todo; 260],
        val: vec![Ok(0); 260],
    };
    let mut parts = Vec::new();
    for idx in 0..260 {
        if !assigned[idx] {
            continue;
        }
        let name = format!("{}{}", (b'A' + (idx / 10) as u8) as char, (b'0' + (idx % 10) as u8) as char);
        match eval_cell(idx, &mut ev) {
            Ok(v) => parts.push(format!("{}={}", name, v)),
            Err(()) => parts.push(format!("{}=#CYCLE", name)),
        }
    }
    parts.join(",")
}
