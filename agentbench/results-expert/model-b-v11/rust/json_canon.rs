use std::collections::BTreeMap;

enum J {
    Obj(Vec<(String, J)>),
    Arr(Vec<J>),
    Str(String),
    Int(String),
    Word(&'static str),
}

struct JP<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> JP<'a> {
    fn ws(&mut self) {
        while self.i < self.b.len() && self.b[self.i].is_ascii_whitespace() {
            self.i += 1;
        }
    }

    fn peek(&self) -> Option<u8> {
        self.b.get(self.i).cloned()
    }

    fn string(&mut self) -> Option<String> {
        if self.peek() != Some(b'\'') {
            return None;
        }
        self.i += 1;
        let s = self.i;
        while self.i < self.b.len() && self.b[self.i] != b'\'' {
            self.i += 1;
        }
        if self.i >= self.b.len() {
            return None;
        }
        let r = String::from_utf8_lossy(&self.b[s..self.i]).into_owned();
        self.i += 1;
        Some(r)
    }

    fn int(&mut self) -> Option<String> {
        let s = self.i;
        if self.peek() == Some(b'-') {
            self.i += 1;
        }
        match self.peek() {
            Some(b'0') => {
                self.i += 1;
            }
            Some(c) if c >= b'1' && c <= b'9' => {
                while let Some(d) = self.peek() {
                    if d.is_ascii_digit() {
                        self.i += 1;
                    } else {
                        break;
                    }
                }
            }
            _ => return None,
        }
        let t = String::from_utf8_lossy(&self.b[s..self.i]).into_owned();
        if t == "-0" {
            Some("0".to_string())
        } else {
            Some(t)
        }
    }

    fn value(&mut self) -> Option<J> {
        self.ws();
        match self.peek()? {
            b'{' => {
                self.i += 1;
                let mut v = Vec::new();
                self.ws();
                if self.peek() == Some(b'}') {
                    self.i += 1;
                    return Some(J::Obj(v));
                }
                loop {
                    self.ws();
                    let k = self.string()?;
                    self.ws();
                    if self.peek() != Some(b':') {
                        return None;
                    }
                    self.i += 1;
                    let val = self.value()?;
                    v.push((k, val));
                    self.ws();
                    match self.peek() {
                        Some(b',') => {
                            self.i += 1;
                        }
                        Some(b'}') => {
                            self.i += 1;
                            return Some(J::Obj(v));
                        }
                        _ => return None,
                    }
                }
            }
            b'[' => {
                self.i += 1;
                let mut v = Vec::new();
                self.ws();
                if self.peek() == Some(b']') {
                    self.i += 1;
                    return Some(J::Arr(v));
                }
                loop {
                    let x = self.value()?;
                    v.push(x);
                    self.ws();
                    match self.peek() {
                        Some(b',') => {
                            self.i += 1;
                        }
                        Some(b']') => {
                            self.i += 1;
                            return Some(J::Arr(v));
                        }
                        _ => return None,
                    }
                }
            }
            b'\'' => self.string().map(J::Str),
            b'-' | b'0'..=b'9' => self.int().map(J::Int),
            _ => {
                let b = self.b;
                let rest = &b[self.i..];
                for w in &["true", "false", "null"] {
                    if rest.starts_with(w.as_bytes()) {
                        self.i += w.len();
                        return Some(J::Word(*w));
                    }
                }
                None
            }
        }
    }
}

fn emit(v: &J, out: &mut String) {
    match v {
        J::Obj(items) => {
            let mut m: BTreeMap<&str, &J> = BTreeMap::new();
            for (k, val) in items {
                m.insert(k.as_str(), val);
            }
            out.push('{');
            let mut first = true;
            for (k, val) in m {
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
        J::Arr(items) => {
            out.push('[');
            for (i, x) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                emit(x, out);
            }
            out.push(']');
        }
        J::Str(s) => {
            out.push('\'');
            out.push_str(s);
            out.push('\'');
        }
        J::Int(s) => out.push_str(s),
        J::Word(w) => out.push_str(w),
    }
}

pub fn json_canon(s: &str) -> String {
    let mut p = JP {
        b: s.as_bytes(),
        i: 0,
    };
    let v = match p.value() {
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
