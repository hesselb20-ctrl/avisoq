use std::cmp::Ordering;

fn strip(v: &mut Vec<u8>) {
    let k = v.iter().position(|&d| d != 0).unwrap_or(v.len());
    v.drain(..k);
}

fn cmp(a: &[u8], b: &[u8]) -> Ordering {
    if a.len() != b.len() {
        return a.len().cmp(&b.len());
    }
    a.cmp(b)
}

// a >= b, both normalized big-endian
fn sub(a: &[u8], b: &[u8]) -> Vec<u8> {
    let mut r = vec![0u8; a.len()];
    let mut borrow = 0i8;
    for k in 0..a.len() {
        let ai = a[a.len() - 1 - k] as i8;
        let bi = if k < b.len() { b[b.len() - 1 - k] as i8 } else { 0 };
        let mut d = ai - bi - borrow;
        if d < 0 {
            d += 10;
            borrow = 1;
        } else {
            borrow = 0;
        }
        r[a.len() - 1 - k] = d as u8;
    }
    strip(&mut r);
    r
}

fn digits(s: &str) -> (bool, Vec<u8>) {
    let s = s.trim();
    let (neg, body) = match s.strip_prefix('-') {
        Some(r) => (true, r),
        None => (false, s),
    };
    let mut v: Vec<u8> = body.bytes().filter(|c| c.is_ascii_digit()).map(|c| c - b'0').collect();
    strip(&mut v);
    (neg, v)
}

fn show(v: &[u8]) -> String {
    if v.is_empty() {
        "0".to_string()
    } else {
        v.iter().map(|d| (d + b'0') as char).collect()
    }
}

pub fn big_divmod(a: &str, b: &str) -> String {
    let (an, av) = digits(a);
    let (bn, bv) = digits(b);
    let mut rem: Vec<u8> = Vec::new();
    let mut q: Vec<u8> = Vec::new();
    for &d in &av {
        rem.push(d);
        strip(&mut rem);
        let mut c = 0u8;
        while cmp(&rem, &bv) != Ordering::Less {
            rem = sub(&rem, &bv);
            c += 1;
        }
        q.push(c);
    }
    strip(&mut q);
    let qs = if (an != bn) && !q.is_empty() { format!("-{}", show(&q)) } else { show(&q) };
    let rs = if an && !rem.is_empty() { format!("-{}", show(&rem)) } else { show(&rem) };
    format!("{} {}", qs, rs)
}
