use std::cmp::Ordering;

// Magnitudes are big-endian decimal digit vectors with no leading zeros; zero is empty.

fn norm_digits(mut v: Vec<u8>) -> Vec<u8> {
    let k = v.iter().take_while(|&&x| x == 0).count();
    if k > 0 {
        v.drain(..k);
    }
    v
}

fn cmp_mag(a: &[u8], b: &[u8]) -> Ordering {
    if a.len() != b.len() {
        return a.len().cmp(&b.len());
    }
    a.cmp(b)
}

fn sub_mag(a: &[u8], b: &[u8]) -> Vec<u8> {
    let n = a.len();
    let mut res = vec![0u8; n];
    let mut borrow: i32 = 0;
    for k in 0..n {
        let ai = a[n - 1 - k] as i32;
        let bi = if k < b.len() {
            b[b.len() - 1 - k] as i32
        } else {
            0
        };
        let mut d = ai - bi - borrow;
        if d < 0 {
            d += 10;
            borrow = 1;
        } else {
            borrow = 0;
        }
        res[n - 1 - k] = d as u8;
    }
    norm_digits(res)
}

fn divmod_mag(a: &[u8], b: &[u8]) -> (Vec<u8>, Vec<u8>) {
    let mut q: Vec<u8> = Vec::with_capacity(a.len());
    let mut r: Vec<u8> = Vec::new();
    for &d in a {
        r.push(d);
        r = norm_digits(r);
        let mut qd = 0u8;
        while cmp_mag(&r, b) != Ordering::Less {
            r = sub_mag(&r, b);
            qd += 1;
        }
        q.push(qd);
    }
    (norm_digits(q), r)
}

fn split_sign(s: &str) -> (bool, Vec<u8>) {
    let (neg, body) = if s.starts_with('-') {
        (true, &s[1..])
    } else {
        (false, s)
    };
    let digits: Vec<u8> = body.bytes().map(|c| c.wrapping_sub(b'0')).collect();
    let digits = norm_digits(digits);
    let neg = neg && !digits.is_empty();
    (neg, digits)
}

fn to_str(v: &[u8]) -> String {
    if v.is_empty() {
        return "0".to_string();
    }
    v.iter().map(|&d| (b'0' + d) as char).collect()
}

pub fn big_divmod(a: &str, b: &str) -> String {
    let (an, ad) = split_sign(a);
    let (bn, bd) = split_sign(b);
    let (q, r) = divmod_mag(&ad, &bd);
    let qneg = an != bn && !q.is_empty();
    let rneg = an && !r.is_empty();
    format!(
        "{}{} {}{}",
        if qneg { "-" } else { "" },
        to_str(&q),
        if rneg { "-" } else { "" },
        to_str(&r)
    )
}
