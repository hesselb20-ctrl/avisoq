pub fn binary_search(xs: &[i64], target: i64) -> i64 {
    let mut lo: usize = 0;
    let mut hi: usize = xs.len();
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if xs[mid] == target {
            return mid as i64;
        } else if xs[mid] < target {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    -1
}
