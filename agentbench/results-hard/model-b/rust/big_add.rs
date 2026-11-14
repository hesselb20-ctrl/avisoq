use std::cmp::Ordering;

// Magnitude as little-endian decimal digits, without high-order zeros (zero is [0]).
fn parse(s: &str) -> (bool, Vec<u8>) {
    let (neg, d) = match s.strip_prefix('-') {
        Some(r) => (true, r),
        None => (false, s),
    };
    let mut mag: Vec<u8> = d.bytes().rev().map(|b| b - b'0').collect();
    trim(&mut mag);
    (neg, mag)
}

fn trim(v: &mut Vec<u8>) {
    while v.len() > 1 && *v.last().unwrap() == 0 {
        v.pop();
    }
    if v.is_empty() {
        v.push(0);
    }
}

fn cmp_mag(a: &[u8], b: &[u8]) -> Ordering {
    if a.len() != b.len() {
        return a.len().cmp(&b.len());
    }
    for i in (0..a.len()).rev() {
        if a[i] != b[i] {
            return a[i].cmp(&b[i]);
        }
    }
    Ordering::Equal
}

fn add_mag(a: &[u8], b: &[u8]) -> Vec<u8> {
    let mut r = Vec::with_capacity(a.len().max(b.len()) + 1);
    let mut carry = 0u8;
    for i in 0..a.len().max(b.len()) {
        let x = if i < a.len() { a[i] } else { 0 };
        let y = if i < b.len() { b[i] } else { 0 };
        let s = x + y + carry;
        r.push(s % 10);
        carry = s / 10;
    }
    if carry > 0 {
        r.push(carry);
    }
    trim(&mut r);
    r
}

// Requires a >= b.
fn sub_mag(a: &[u8], b: &[u8]) -> Vec<u8> {
    let mut r = Vec::with_capacity(a.len());
    let mut borrow = 0i8;
    for i in 0..a.len() {
        let x = a[i] as i8;
        let y = if i < b.len() { b[i] as i8 } else { 0 };
        let mut d = x - y - borrow;
        if d < 0 {
            d += 10;
            borrow = 1;
        } else {
            borrow = 0;
        }
        r.push(d as u8);
    }
    trim(&mut r);
    r
}

pub fn big_add(a: &str, b: &str) -> String {
    let (na, ma) = parse(a);
    let (nb, mb) = parse(b);
    let (neg, mag) = if na == nb {
        (na, add_mag(&ma, &mb))
    } else {
        match cmp_mag(&ma, &mb) {
            Ordering::Equal => (false, vec![0]),
            Ordering::Greater => (na, sub_mag(&ma, &mb)),
            Ordering::Less => (nb, sub_mag(&mb, &ma)),
        }
    };
    if mag.len() == 1 && mag[0] == 0 {
        return "0".to_string();
    }
    let mut s = String::with_capacity(mag.len() + 1);
    if neg {
        s.push('-');
    }
    for &d in mag.iter().rev() {
        s.push((b'0' + d) as char);
    }
    s
}
