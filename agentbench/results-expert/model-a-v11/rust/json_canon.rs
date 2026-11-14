use std::collections::BTreeMap;

struct P<'a> {
    s: &'a str,
    b: &'a [u8],
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
    fn string(&mut self) -> Option<String> {
        if self.peek()? != b'\'' {
            return None;
        }
        let st = self.i + 1;
        let mut j = st;
        while j < self.b.len() && self.b[j] != b'\'' {
            j += 1;
        }
        if j >= self.b.len() {
            return None;
        }
        self.i = j + 1;
        Some(self.s[st..j].to_string())
    }
    fn value(&mut self, depth: usize) -> Option<String> {
        if depth > 200 {
            return None;
        }
        self.ws();
        let c = self.peek()?;
        match c {
            b'{' => {
                self.i += 1;
                self.ws();
                let mut m: BTreeMap<String, String> = BTreeMap::new();
                if self.peek()? == b'}' {
                    self.i += 1;
                    return Some("{}".to_string());
                }
                loop {
                    self.ws();
                    let k = self.string()?;
                    self.ws();
                    if self.peek()? != b':' {
                        return None;
                    }
                    self.i += 1;
                    let v = self.value(depth + 1)?;
                    m.insert(k, v);
                    self.ws();
                    match self.peek()? {
                        b',' => self.i += 1,
                        b'}' => {
                            self.i += 1;
                            break;
                        }
                        _ => return None,
                    }
                }
                let parts: Vec<String> = m.iter().map(|(k, v)| format!("'{}':{}", k, v)).collect();
                Some(format!("{{{}}}", parts.join(",")))
            }
            b'[' => {
                self.i += 1;
                self.ws();
                if self.peek()? == b']' {
                    self.i += 1;
                    return Some("[]".to_string());
                }
                let mut parts = Vec::new();
                loop {
                    parts.push(self.value(depth + 1)?);
                    self.ws();
                    match self.peek()? {
                        b',' => self.i += 1,
                        b']' => {
                            self.i += 1;
                            break;
                        }
                        _ => return None,
                    }
                }
                Some(format!("[{}]", parts.join(",")))
            }
            b'\'' => {
                let s = self.string()?;
                Some(format!("'{}'", s))
            }
            b'-' | b'0'..=b'9' => {
                let st = self.i;
                if c == b'-' {
                    self.i += 1;
                }
                let d = self.peek()?;
                if d == b'0' {
                    self.i += 1;
                } else if (b'1'..=b'9').contains(&d) {
                    while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
                        self.i += 1;
                    }
                } else {
                    return None;
                }
                let t = &self.s[st..self.i];
                if t == "-0" {
                    Some("0".to_string())
                } else {
                    Some(t.to_string())
                }
            }
            _ => {
                let rest = &self.b[self.i..];
                for w in ["true", "false", "null"] {
                    if rest.starts_with(w.as_bytes()) {
                        self.i += w.len();
                        return Some(w.to_string());
                    }
                }
                None
            }
        }
    }
}

pub fn json_canon(s: &str) -> String {
    let mut p = P { s, b: s.as_bytes(), i: 0 };
    match p.value(0) {
        Some(v) => {
            p.ws();
            if p.i == p.b.len() {
                v
            } else {
                "error".to_string()
            }
        }
        None => "error".to_string(),
    }
}
