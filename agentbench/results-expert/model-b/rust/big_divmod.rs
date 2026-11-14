use std::cmp::Ordering;

// Magnitude as decimal digits, most significant first, without leading zeros (zero is empty).
fn strip(v: &mut Vec<u8>) {
    let k = v.iter().take_while(|&&d| d == 0).count();
    v.drain(0..k);
}

fn parse_mag(s: &str) -> (bool, Vec<u8>) {
    let (neg, digits) = if s.starts_with('-') { (true, &s[1..]) } else { (false, s) };
    let mut v: Vec<u8> = digits.bytes().map(|c| c - b'0').collect();
    strip(&mut v);
    (neg, v)
}

fn cmp_mag(a: &[u8], b: &[u8]) -> Ordering {
    a.len().cmp(&b.len()).then_with(|| a.cmp(b))
}

// a - b, requires a >= b; both normalised.
fn sub_mag(a: &[u8], b: &[u8]) -> Vec<u8> {
    let mut out: Vec<u8> = Vec::new();
    let mut i = a.len() as isize - 1;
    let mut j = b.len() as isize - 1;
    let mut borrow = 0i32;
    while i >= 0 {
        let mut d = a[i as usize] as i32 - borrow;
        if j >= 0 {
            d -= b[j as usize] as i32;
            j -= 1;
        }
        if d < 0 {
            d += 10;
            borrow = 1;
        } else {
            borrow = 0;
        }
        out.push(d as u8);
        i -= 1;
    }
    out.reverse();
    strip(&mut out);
    out
}

fn digits_to_string(v: &[u8]) -> String {
    if v.is_empty() {
        return "0".to_string();
    }
    v.iter().map(|&d| (b'0' + d) as char).collect()
}

pub fn big_divmod(a: &str, b: &str) -> String {
    let (an, am) = parse_mag(a);
    let (bn, bm) = parse_mag(b);
    let mut q: Vec<u8> = Vec::new();
    let mut rem: Vec<u8> = Vec::new();
    for &d in am.iter() {
        rem.push(d);
        strip(&mut rem);
        let mut qd = 0u8;
        while cmp_mag(&rem, &bm) != Ordering::Less {
            rem = sub_mag(&rem, &bm);
            qd += 1;
        }
        q.push(qd);
    }
    strip(&mut q);
    let qneg = an != bn && !q.is_empty();
    let rneg = an && !rem.is_empty();
    format!(
        "{}{} {}{}",
        if qneg { "-" } else { "" },
        digits_to_string(&q),
        if rneg { "-" } else { "" },
        digits_to_string(&rem)
    )
}
