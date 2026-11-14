use std::cmp::Ordering;
fn cmp_mag(a: &[u8], b: &[u8]) -> Ordering {
    if a.len() != b.len() { return a.len().cmp(&b.len()); }
    a.cmp(b)
}
fn add_mag(a: &[u8], b: &[u8]) -> Vec<u8> {
    let mut r = vec![]; let mut c = 0u8;
    let (mut i, mut j) = (a.len(), b.len());
    while i > 0 || j > 0 || c > 0 {
        let mut s = c;
        if i > 0 { i -= 1; s += a[i] - b'0'; }
        if j > 0 { j -= 1; s += b[j] - b'0'; }
        r.push(b'0' + s % 10); c = s / 10;
    }
    r.reverse(); r
}
fn sub_mag(a: &[u8], b: &[u8]) -> Vec<u8> {
    let mut r = vec![]; let mut br = 0i8;
    let mut j = b.len();
    for i in (0..a.len()).rev() {
        let mut d = (a[i] - b'0') as i8 - br;
        if j > 0 { j -= 1; d -= (b[j] - b'0') as i8; }
        if d < 0 { d += 10; br = 1 } else { br = 0 }
        r.push(b'0' + d as u8);
    }
    while r.len() > 1 && *r.last().unwrap() == b'0' { r.pop(); }
    r.reverse(); r
}
pub fn big_add(a: &str, b: &str) -> String {
    let (na, ma) = match a.strip_prefix('-') { Some(x) => (true, x.as_bytes()), None => (false, a.as_bytes()) };
    let (nb, mb) = match b.strip_prefix('-') { Some(x) => (true, x.as_bytes()), None => (false, b.as_bytes()) };
    let (neg, mag) = if na == nb { (na, add_mag(ma, mb)) } else {
        match cmp_mag(ma, mb) {
            Ordering::Equal => (false, vec![b'0']),
            Ordering::Greater => (na, sub_mag(ma, mb)),
            Ordering::Less => (nb, sub_mag(mb, ma)),
        }
    };
    let mut s = String::from_utf8(mag).unwrap();
    if s.is_empty() { s = "0".to_string(); }
    if neg && s != "0" { format!("-{}", s) } else { s }
}
