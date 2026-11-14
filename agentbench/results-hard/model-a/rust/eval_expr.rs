struct P<'a> { b: &'a [u8], i: usize, z: bool }
impl<'a> P<'a> {
    fn ws(&mut self) { while self.i < self.b.len() && self.b[self.i] == b' ' { self.i += 1; } }
    fn expr(&mut self) -> i128 {
        let mut v = self.term();
        loop {
            self.ws();
            if self.i < self.b.len() && (self.b[self.i] == b'+' || self.b[self.i] == b'-') {
                let op = self.b[self.i]; self.i += 1;
                let r = self.term();
                v = if op == b'+' { v + r } else { v - r };
            } else { return v; }
        }
    }
    fn term(&mut self) -> i128 {
        let mut v = self.unary();
        loop {
            self.ws();
            if self.i < self.b.len() && (self.b[self.i] == b'*' || self.b[self.i] == b'/' || self.b[self.i] == b'%') {
                let op = self.b[self.i]; self.i += 1;
                let r = self.unary();
                if op == b'*' { v = v.wrapping_mul(r); }
                else if r == 0 { self.z = true; v = 0; }
                else if op == b'/' { v = v / r; } else { v = v % r; }
            } else { return v; }
        }
    }
    fn unary(&mut self) -> i128 {
        self.ws();
        if self.i < self.b.len() && self.b[self.i] == b'-' { self.i += 1; return -self.unary(); }
        if self.i < self.b.len() && self.b[self.i] == b'(' {
            self.i += 1; let v = self.expr(); self.ws();
            if self.i < self.b.len() && self.b[self.i] == b')' { self.i += 1; }
            return v;
        }
        let mut v: i128 = 0;
        while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
            v = v.wrapping_mul(10).wrapping_add((self.b[self.i] - b'0') as i128); self.i += 1;
        }
        v
    }
}
pub fn eval_expr(s: &str) -> String {
    let mut p = P { b: s.as_bytes(), i: 0, z: false };
    let v = p.expr();
    if p.z { "div0".to_string() } else { v.to_string() }
}
