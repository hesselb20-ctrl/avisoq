fn bd_trim(v: &mut Vec<u8>) {
    let z = v.iter().take_while(|&&d| d == 0).count();
    v.drain(..z);
}

fn bd_ge(a: &[u8], b: &[u8]) -> bool {
    // both trimmed
    if a.len() != b.len() {
        return a.len() > b.len();
    }
    a >= b
}

fn bd_sub(a: &mut Vec<u8>, b: &[u8]) {
    let mut borrow = 0i32;
    let mut i = a.len();
    let mut j = b.len();
    while i > 0 {
        i -= 1;
        let bv = if j > 0 {
            j -= 1;
            b[j] as i32
        } else {
            0
        };
        let mut d = a[i] as i32 - bv - borrow;
        if d < 0 {
            d += 10;
            borrow = 1;
        } else {
            borrow = 0;
        }
        a[i] = d as u8;
    }
    bd_trim(a);
}

pub fn big_divmod(a: &str, b: &str) -> String {
    let an = a.starts_with('-');
    let bn = b.starts_with('-');
    let ad: Vec<u8> = a.trim_start_matches('-').bytes().map(|c| c - b'0').collect();
    let mut bd: Vec<u8> = b.trim_start_matches('-').bytes().map(|c| c - b'0').collect();
    bd_trim(&mut bd);
    let mut rem: Vec<u8> = Vec::new();
    let mut q: Vec<u8> = Vec::new();
    for &d in &ad {
        rem.push(d);
        bd_trim(&mut rem);
        let mut cnt = 0u8;
        while bd_ge(&rem, &bd) {
            bd_sub(&mut rem, &bd);
            cnt += 1;
        }
        q.push(cnt);
    }
    bd_trim(&mut q);
    bd_trim(&mut rem);
    let qs: String = if q.is_empty() { "0".into() } else { q.iter().map(|d| (d + b'0') as char).collect() };
    let rs: String = if rem.is_empty() { "0".into() } else { rem.iter().map(|d| (d + b'0') as char).collect() };
    let qneg = an != bn && qs != "0";
    let rneg = an && rs != "0";
    format!("{}{} {}{}", if qneg { "-" } else { "" }, qs, if rneg { "-" } else { "" }, rs)
}
