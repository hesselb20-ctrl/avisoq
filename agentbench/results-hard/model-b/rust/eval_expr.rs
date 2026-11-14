struct EvalParser<'a> {
    s: &'a [u8],
    pos: usize,
    div0: bool,
}

impl<'a> EvalParser<'a> {
    fn peek(&mut self) -> Option<u8> {
        while self.pos < self.s.len() && self.s[self.pos].is_ascii_whitespace() {
            self.pos += 1;
        }
        if self.pos < self.s.len() {
            Some(self.s[self.pos])
        } else {
            None
        }
    }

    fn expr(&mut self) -> i64 {
        let mut v = self.term();
        loop {
            match self.peek() {
                Some(b'+') => {
                    self.pos += 1;
                    let r = self.term();
                    v = v.wrapping_add(r);
                }
                Some(b'-') => {
                    self.pos += 1;
                    let r = self.term();
                    v = v.wrapping_sub(r);
                }
                _ => break,
            }
        }
        v
    }

    fn term(&mut self) -> i64 {
        let mut v = self.unary();
        loop {
            match self.peek() {
                Some(b'*') => {
                    self.pos += 1;
                    let r = self.unary();
                    v = v.wrapping_mul(r);
                }
                Some(b'/') => {
                    self.pos += 1;
                    let r = self.unary();
                    if r == 0 {
                        self.div0 = true;
                        v = 0;
                    } else {
                        v = v.wrapping_div(r);
                    }
                }
                Some(b'%') => {
                    self.pos += 1;
                    let r = self.unary();
                    if r == 0 {
                        self.div0 = true;
                        v = 0;
                    } else {
                        v = v.wrapping_rem(r);
                    }
                }
                _ => break,
            }
        }
        v
    }

    fn unary(&mut self) -> i64 {
        match self.peek() {
            Some(b'-') => {
                self.pos += 1;
                self.unary().wrapping_neg()
            }
            Some(b'+') => {
                self.pos += 1;
                self.unary()
            }
            _ => self.primary(),
        }
    }

    fn primary(&mut self) -> i64 {
        match self.peek() {
            Some(b'(') => {
                self.pos += 1;
                let v = self.expr();
                if self.peek() == Some(b')') {
                    self.pos += 1;
                }
                v
            }
            _ => {
                let mut v: i64 = 0;
                while self.pos < self.s.len() && self.s[self.pos].is_ascii_digit() {
                    v = v.wrapping_mul(10).wrapping_add((self.s[self.pos] - b'0') as i64);
                    self.pos += 1;
                }
                v
            }
        }
    }
}

pub fn eval_expr(s: &str) -> String {
    let mut p = EvalParser {
        s: s.as_bytes(),
        pos: 0,
        div0: false,
    };
    let v = p.expr();
    if p.div0 {
        "div0".to_string()
    } else {
        v.to_string()
    }
}
