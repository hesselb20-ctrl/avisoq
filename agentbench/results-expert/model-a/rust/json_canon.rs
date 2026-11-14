use std::collections::BTreeMap;

struct J {
    c: Vec<char>,
    p: usize,
}

impl J {
    fn ws(&mut self) {
        while self.p < self.c.len() && self.c[self.p] == ' ' {
            self.p += 1;
        }
    }
    fn lit(&mut self, w: &str) -> bool {
        let wc: Vec<char> = w.chars().collect();
        if self.p + wc.len() <= self.c.len() && self.c[self.p..self.p + wc.len()] == wc[..] {
            self.p += wc.len();
            true
        } else {
            false
        }
    }
    fn string(&mut self) -> Option<String> {
        if self.c.get(self.p) != Some(&'\'') {
            return None;
        }
        self.p += 1;
        let mut s = String::new();
        while self.p < self.c.len() {
            let ch = self.c[self.p];
            self.p += 1;
            if ch == '\'' {
                return Some(s);
            }
            s.push(ch);
        }
        None
    }
    fn value(&mut self) -> Option<String> {
        self.ws();
        let ch = *self.c.get(self.p)?;
        match ch {
            '{' => {
                self.p += 1;
                let mut m: BTreeMap<String, String> = BTreeMap::new();
                self.ws();
                if self.c.get(self.p) == Some(&'}') {
                    self.p += 1;
                    return Some("{}".to_string());
                }
                loop {
                    self.ws();
                    let k = self.string()?;
                    self.ws();
                    if self.c.get(self.p) != Some(&':') {
                        return None;
                    }
                    self.p += 1;
                    let v = self.value()?;
                    m.insert(k, v);
                    self.ws();
                    match self.c.get(self.p) {
                        Some(',') => self.p += 1,
                        Some('}') => {
                            self.p += 1;
                            break;
                        }
                        _ => return None,
                    }
                }
                let parts: Vec<String> = m.iter().map(|(k, v)| format!("'{}':{}", k, v)).collect();
                Some(format!("{{{}}}", parts.join(",")))
            }
            '[' => {
                self.p += 1;
                let mut v = Vec::new();
                self.ws();
                if self.c.get(self.p) == Some(&']') {
                    self.p += 1;
                    return Some("[]".to_string());
                }
                loop {
                    v.push(self.value()?);
                    self.ws();
                    match self.c.get(self.p) {
                        Some(',') => self.p += 1,
                        Some(']') => {
                            self.p += 1;
                            break;
                        }
                        _ => return None,
                    }
                }
                Some(format!("[{}]", v.join(",")))
            }
            '\'' => {
                let s = self.string()?;
                Some(format!("'{}'", s))
            }
            '-' | '0'..='9' => {
                let mut neg = false;
                if ch == '-' {
                    neg = true;
                    self.p += 1;
                }
                let st = self.p;
                match self.c.get(self.p) {
                    Some('0') => self.p += 1,
                    Some('1'..='9') => {
                        while matches!(self.c.get(self.p), Some('0'..='9')) {
                            self.p += 1;
                        }
                    }
                    _ => return None,
                }
                let d: String = self.c[st..self.p].iter().collect();
                if d == "0" {
                    Some("0".to_string())
                } else if neg {
                    Some(format!("-{}", d))
                } else {
                    Some(d)
                }
            }
            _ => {
                if self.lit("true") {
                    Some("true".into())
                } else if self.lit("false") {
                    Some("false".into())
                } else if self.lit("null") {
                    Some("null".into())
                } else {
                    None
                }
            }
        }
    }
}

pub fn json_canon(s: &str) -> String {
    let mut j = J { c: s.chars().collect(), p: 0 };
    match j.value() {
        Some(v) => {
            j.ws();
            if j.p == j.c.len() {
                v
            } else {
                "error".to_string()
            }
        }
        None => "error".to_string(),
    }
}
