use std::collections::BTreeMap;

enum V {
    Obj(BTreeMap<String, V>),
    Arr(Vec<V>),
    Str(String),
    Num(String),
    Lit(&'static str),
}

struct P<'a> {
    b: &'a [u8],
    s: &'a str,
    i: usize,
}

impl<'a> P<'a> {
    fn ws(&mut self) {
        while self.i < self.b.len() && self.b[self.i] == b' ' {
            self.i += 1;
        }
    }

    fn peek(&self) -> Option<u8> {
        self.b.get(self.i).copied()
    }

    fn parse_str(&mut self) -> Option<String> {
        if self.peek() != Some(b'\'') {
            return None;
        }
        self.i += 1;
        let st = self.i;
        while self.i < self.b.len() && self.b[self.i] != b'\'' {
            self.i += 1;
        }
        if self.i >= self.b.len() {
            return None;
        }
        let r = self.s[st..self.i].to_string();
        self.i += 1;
        Some(r)
    }

    fn parse_num(&mut self) -> Option<V> {
        let st = self.i;
        if self.b[self.i] == b'-' {
            self.i += 1;
        }
        if self.i >= self.b.len() {
            return None;
        }
        if self.b[self.i] == b'0' {
            self.i += 1;
        } else if self.b[self.i].is_ascii_digit() {
            while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
                self.i += 1;
            }
        } else {
            return None;
        }
        if self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
            return None;
        }
        let t = &self.s[st..self.i];
        let t = if t == "-0" { "0" } else { t };
        Some(V::Num(t.to_string()))
    }

    fn parse_value(&mut self) -> Option<V> {
        self.ws();
        let c = self.peek()?;
        match c {
            b'{' => {
                self.i += 1;
                let mut m = BTreeMap::new();
                self.ws();
                if self.peek() == Some(b'}') {
                    self.i += 1;
                    return Some(V::Obj(m));
                }
                loop {
                    self.ws();
                    let k = self.parse_str()?;
                    self.ws();
                    if self.peek() != Some(b':') {
                        return None;
                    }
                    self.i += 1;
                    let v = self.parse_value()?;
                    m.insert(k, v);
                    self.ws();
                    match self.peek() {
                        Some(b',') => {
                            self.i += 1;
                        }
                        Some(b'}') => {
                            self.i += 1;
                            return Some(V::Obj(m));
                        }
                        _ => return None,
                    }
                }
            }
            b'[' => {
                self.i += 1;
                let mut a = Vec::new();
                self.ws();
                if self.peek() == Some(b']') {
                    self.i += 1;
                    return Some(V::Arr(a));
                }
                loop {
                    let v = self.parse_value()?;
                    a.push(v);
                    self.ws();
                    match self.peek() {
                        Some(b',') => {
                            self.i += 1;
                        }
                        Some(b']') => {
                            self.i += 1;
                            return Some(V::Arr(a));
                        }
                        _ => return None,
                    }
                }
            }
            b'\'' => {
                let s = self.parse_str()?;
                Some(V::Str(s))
            }
            b'-' | b'0'..=b'9' => self.parse_num(),
            _ => {
                let words: [&'static str; 3] = ["true", "false", "null"];
                for w in words.iter() {
                    if self.b[self.i..].starts_with(w.as_bytes()) {
                        self.i += w.len();
                        return Some(V::Lit(w));
                    }
                }
                None
            }
        }
    }
}

fn emit(v: &V, out: &mut String) {
    match v {
        V::Obj(m) => {
            out.push('{');
            let mut first = true;
            for (k, val) in m.iter() {
                if !first {
                    out.push(',');
                }
                first = false;
                out.push('\'');
                out.push_str(k);
                out.push('\'');
                out.push(':');
                emit(val, out);
            }
            out.push('}');
        }
        V::Arr(a) => {
            out.push('[');
            let mut first = true;
            for val in a.iter() {
                if !first {
                    out.push(',');
                }
                first = false;
                emit(val, out);
            }
            out.push(']');
        }
        V::Str(s) => {
            out.push('\'');
            out.push_str(s);
            out.push('\'');
        }
        V::Num(n) => out.push_str(n),
        V::Lit(l) => out.push_str(l),
    }
}

pub fn json_canon(s: &str) -> String {
    let mut p = P {
        b: s.as_bytes(),
        s,
        i: 0,
    };
    let v = match p.parse_value() {
        Some(v) => v,
        None => return "error".to_string(),
    };
    p.ws();
    if p.i != p.b.len() {
        return "error".to_string();
    }
    let mut out = String::new();
    emit(&v, &mut out);
    out
}
